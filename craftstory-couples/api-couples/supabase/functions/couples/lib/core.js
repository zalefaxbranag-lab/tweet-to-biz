/* Le coeur de l'API, sans hote.
 *
 * Deux fonctions pures cote HTTP : elles recoivent une demande deja lue
 * ({ method, origin, ip, base, body }) et rendent { status, body, headers }.
 * La fonction Supabase (Deno) et les tests (Node) les appellent de la meme
 * facon : une seule source de verite, testee telle qu'elle tourne.
 *
 *   doStart   le dernier clic du tunnel : photos + reponses -> la chanson
 *             complete et les six images partent ensemble, un jeton revient.
 *   doStatus  la page demande ou en est sa preview, toutes les cinq secondes.
 */
import { kie } from './kie.js';
import { songPrompt, scenes, carry } from './brief.js';
import { sign, verify, secretFrom } from './token.js';

// ------------------------------------------------------------------- CORS
// Seule la boutique peut appeler l'API depuis un navigateur. Ce n'est pas une
// authentification — un curl pose l'Origin qu'il veut — mais ca ferme la porte
// aux sites tiers qui voudraient bruler les credits depuis la page d'un autre.
export function allowedHost(host) {
  const h = String(host || '').toLowerCase();
  return h === 'craftstory.co' || h.endsWith('.craftstory.co') || h.endsWith('.myshopify.com');
}

export function corsFor(origin) {
  let ok = false;
  try { ok = allowedHost(new URL(origin).hostname); } catch (e) { ok = false; }
  return {
    ok: ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin : 'https://craftstory.co',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
  };
}

function out(status, body, headers) {
  return {
    status: status,
    body: body,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {})
  };
}

// ------------------------------------------------------------------ START
const DATA_IMG = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_PHOTO = 4000000;   // caracteres de dataURL : une photo reduite en fait 200 a 500 k

// Un garde-fou par instance, sans base : cinq lancements par adresse et par
// dix minutes. Ce n'est pas une muraille, mais une page qui boucle ou un
// double clic ne brulent plus sept taches payantes a chaque fois.
const seen = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (seen.get(ip) || []).filter(function (t) { return now - t < 600000; });
  list.push(now);
  seen.set(ip, list);
  if (seen.size > 5000) seen.clear();
  return list.length > 5;
}

export async function doStart(q, deps) {
  const c = corsFor(q.origin);
  if (q.method === 'OPTIONS') return out(204, null, c.headers);
  if (q.method !== 'POST') return out(405, { error: 'POST only' }, c.headers);
  if (!c.ok) return out(403, { error: 'origin' }, c.headers);

  const env = deps.env;
  if (!env.KIE_KEY) return out(503, { error: 'not configured' }, c.headers);
  if (tooMany(q.ip || '?')) return out(429, { error: 'slow down' }, c.headers);

  const a = q.body || {};
  const photos = [a.photo, a.photo2]
    .filter(function (p) { return typeof p === 'string' && p.length <= MAX_PHOTO && DATA_IMG.test(p); })
    .slice(0, 2);
  if (!photos.length) return out(400, { error: 'photo' }, c.headers);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(a.email || '').trim())) {
    return out(400, { error: 'email' }, c.headers);
  }

  const k = kie(env, deps.fetch);
  const stamp = Date.now();

  // 1. Les photos, une fois : les six images reutilisent les memes URL.
  const urls = (await Promise.all(photos.map(function (p, i) {
    return k.upload(p, 'duo-' + stamp + '-' + i + (p.indexOf('image/png') > -1 ? '.png' : '.jpg'));
  }))).filter(Boolean);
  if (!urls.length) return out(502, { error: 'upload' }, c.headers);

  // 2. La chanson complete et les six scenes, ENSEMBLE. Les images ne
  // dependent que des photos, la chanson que des reponses : attendre l'une
  // pour lancer l'autre ferait perdre une minute sur trois.
  const list = scenes(a, urls.length);
  const made = await Promise.all([k.createSong(songPrompt(a), q.base + '/callback')]
    .concat(list.map(function (s) { return k.createImage(s.prompt, urls); })));
  const song = made[0];
  if (!song) return out(502, { error: 'song' }, c.headers);

  // Une image qui n'a pas pu etre creee n'arrete rien : son identifiant reste
  // vide, et doStatus la relance au premier passage.
  const job = sign({
    v: 1,
    t: stamp,
    s: song,
    sr: 0,
    i: made.slice(1).map(function (x) { return x || ''; }),
    ir: [0, 0, 0, 0, 0, 0],
    p: urls,
    a: carry(a)
  }, secretFrom(env));

  return out(200, { job: job, status: q.base + '/status', eta: 150 }, c.headers);
}

// ----------------------------------------------------------------- STATUS
const SECONDS = 30;
const PER = 5;
// Au-dela, on n'attend plus les images en retard : la preview part avec
// celles qui sont la, le trou est comble par une voisine.
const LATE = 6 * 60 * 1000;
// Au-dela, la chanson est declaree perdue et la page passe a son repli.
const DEAD = 9 * 60 * 1000;
// Le leger zoom, qui alterne d'une image a l'autre.
const DRIFT = ['in', 'out', 'in', 'out', 'in', 'out'];

export async function doStatus(q, deps) {
  const c = corsFor(q.origin);
  if (q.method === 'OPTIONS') return out(204, null, c.headers);
  if (q.method !== 'POST') return out(405, { error: 'POST only' }, c.headers);
  if (!c.ok) return out(403, { error: 'origin' }, c.headers);

  const env = deps.env;
  if (!env.KIE_KEY) return out(503, { error: 'not configured' }, c.headers);
  const secret = secretFrom(env);
  const body = q.body || {};
  const p = verify(body.job, secret, 24 * 3600 * 1000);
  if (!p) return out(400, { error: 'job' }, c.headers);

  const k = kie(env, deps.fetch);
  const age = Date.now() - p.t;

  const all = await Promise.all([k.songInfo(p.s)].concat(p.i.map(function (id) { return k.imageInfo(id); })));
  let song = all[0];
  const imgs = all.slice(1);
  let changed = false;

  // La chanson perdue : on la relance une fois, avec le meme brief.
  if (song.state === 'failed' && p.sr < 1 && age < DEAD) {
    const again = await k.createSong(songPrompt(p.a), q.base + '/callback');
    p.sr += 1;
    changed = true;
    if (again) { p.s = again; song = { state: 'running' }; }
  }

  // Une image perdue : on la relance une fois, SANS leurs mots libres. On ne
  // contourne rien sur la photo : si c'est elle qui est refusee, le second
  // essai l'est aussi, et la place est comblee par une autre image.
  const list = scenes(p.a, p.p.length);
  for (let n = 0; n < imgs.length; n++) {
    if (imgs[n].state !== 'failed' || p.ir[n] >= 1 || age > LATE) continue;
    const again = await k.createImage(list[n].safe, p.p);
    p.ir[n] += 1;
    changed = true;
    if (again) { p.i[n] = again; imgs[n] = { state: 'running' }; }
  }

  const done = imgs.filter(function (x) { return x.state === 'done'; });
  const settled = imgs.every(function (x, n) {
    return x.state === 'done' || (x.state === 'failed' && (p.ir[n] >= 1 || age > LATE));
  });
  const job = changed ? sign(p, secret) : body.job;

  if (song.state === 'failed' && (p.sr >= 1 || age > DEAD)) {
    return out(200, { ready: false, failed: true, reason: 'song' }, c.headers);
  }
  if (age > DEAD && song.state !== 'done') {
    return out(200, { ready: false, failed: true, reason: 'timeout' }, c.headers);
  }
  if (settled && !done.length) {
    return out(200, { ready: false, failed: true, reason: 'images' }, c.headers);
  }

  const imagesReady = done.length > 0 && (settled || (age > LATE && done.length >= 3));
  if (song.state !== 'done' || !imagesReady) {
    return out(200, {
      ready: false,
      done: done.length + (song.state === 'done' ? 1 : 0),
      of: 7,
      job: job
    }, c.headers);
  }

  // Tout est la. La preview demarre sur la voix si Suno sait dire ou tombe le
  // premier mot ; sinon a zero. Jamais au-dela de vingt secondes.
  let start = 0;
  if (song.audioId) {
    const words = await k.songWords(p.s, song.audioId);
    if (words && words.length) {
      const first = words.find(function (w) { return w && Number(w.startS) >= 0; });
      if (first) start = Math.max(0, Math.min(20, Number(first.startS) - 0.4));
    }
  }
  // Si la chanson est plus courte que la preview, on ne demarre pas trop loin.
  if (song.duration && start + SECONDS > song.duration) start = Math.max(0, song.duration - SECONDS);

  // Six plans de cinq secondes. Une scene manquante prend l'image d'une
  // voisine : jamais un trou noir au milieu des trente secondes.
  const got = imgs.map(function (x) { return x.state === 'done' ? x.url : ''; });
  const pool = got.filter(Boolean);
  const beats = got.map(function (u, n) {
    return { at: n * PER, dur: PER, clip: '', poster: u || pool[n % pool.length], line: '', drift: DRIFT[n] };
  });

  return out(200, {
    ready: true,
    song: song.url,
    songStart: Math.round(start * 100) / 100,
    seconds: SECONDS,
    beats: beats,
    title: song.title || '',
    // Ce dont l'atelier aura besoin pour produire la video payee.
    photos: p.p,
    job: job
  }, c.headers);
}
