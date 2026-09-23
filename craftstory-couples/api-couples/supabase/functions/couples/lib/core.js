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
 *   doOrder   le clic sur « payer » : le dossier est range sous une cle privee.
 *   doTick    le minuteur : fait avancer les videos payees (voir full.js).
 *   doVideo   la page du client : sa video complete, une fois payee et prete.
 */
import { kie } from './kie.js';
import { songPrompt, scenes, carry } from './brief.js';
import { sign, verify, secretFrom } from './token.js';
import { store } from './store.js';
import { plan, advance, playable, progress, anyImage } from './full.js';
import { createHmac } from 'node:crypto';

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

// Le minuteur (et nos essais de bout en bout) presentent la cle du coffre.
function trusted(q, env) {
  return !!(env.TICK_KEY && q.tick && q.tick === env.TICK_KEY);
}

export async function doStart(q, deps) {
  const c = corsFor(q.origin);
  if (q.method === 'OPTIONS') return out(204, null, c.headers);
  if (q.method !== 'POST') return out(405, { error: 'POST only' }, c.headers);
  const env = deps.env;
  const inside = trusted(q, env);
  if (!c.ok && !inside) return out(403, { error: 'origin' }, c.headers);

  if (!env.KIE_KEY) return out(503, { error: 'not configured' }, c.headers);
  if (!inside && tooMany(q.ip || '?')) return out(429, { error: 'slow down' }, c.headers);

  const a = q.body || {};
  const photos = [a.photo, a.photo2]
    .filter(function (p) { return typeof p === 'string' && p.length <= MAX_PHOTO && DATA_IMG.test(p); })
    .slice(0, 2);
  // Essai interne : une photo deja en ligne (un visage synthetique, jamais
  // celui d'un client).
  const given = inside && /^https:\/\/\S+$/.test(String(a.photo_url || '')) ? [a.photo_url] : [];
  if (!photos.length && !given.length) return out(400, { error: 'photo' }, c.headers);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(a.email || '').trim())) {
    return out(400, { error: 'email' }, c.headers);
  }

  const k = kie(env, deps.fetch);
  const stamp = Date.now();

  // 1. Les photos, une fois : les six images reutilisent les memes URL.
  const urls = given.length ? given : (await Promise.all(photos.map(function (p, i) {
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
  const env = deps.env;
  if (!c.ok && !trusted(q, env)) return out(403, { error: 'origin' }, c.headers);

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

// Le depart sur la voix, partage par la preview et la video complete.
async function voiceStart(k, taskId, song) {
  let start = 0;
  if (song.audioId) {
    const words = await k.songWords(taskId, song.audioId);
    if (words && words.length) {
      const first = words.find(function (w) { return w && Number(w.startS) >= 0; });
      if (first) start = Math.max(0, Math.min(20, Number(first.startS) - 0.4));
    }
  }
  if (song.duration && start + SECONDS > song.duration) start = Math.max(0, song.duration - SECONDS);
  return Math.round(start * 100) / 100;
}

// ------------------------------------------------------------------ ORDER
/* Le clic sur « payer ». Le dossier de la preview (reponses, photos, chanson,
 * six images) est range sous une cle privee, et la cle revient a la page qui
 * l'ajoute a la commande : c'est l'adresse de la video du client. Rien n'est
 * genere ici — la video complete ne part qu'une fois le paiement verifie.
 */
const orders = new Map();
function tooManyOrders(ip) {
  const now = Date.now();
  const list = (orders.get(ip) || []).filter(function (t) { return now - t < 600000; });
  list.push(now);
  orders.set(ip, list);
  if (orders.size > 5000) orders.clear();
  return list.length > 20;
}

export function viewKey(p, secret) {
  return createHmac('sha256', secret).update('view:' + p.t + ':' + (p.p || []).join(',')).digest('hex').slice(0, 24);
}

export async function doOrder(q, deps) {
  const c = corsFor(q.origin);
  if (q.method === 'OPTIONS') return out(204, null, c.headers);
  if (q.method !== 'POST') return out(405, { error: 'POST only' }, c.headers);
  const env = deps.env;
  const inside = trusted(q, env);
  if (!c.ok && !inside) return out(403, { error: 'origin' }, c.headers);
  if (!env.KIE_KEY && !env.TOKEN_SECRET) return out(503, { error: 'not configured' }, c.headers);
  if (!inside && tooManyOrders(q.ip || '?')) return out(429, { error: 'slow down' }, c.headers);

  const secret = secretFrom(env);
  const body = q.body || {};
  const p = verify(body.job, secret, 30 * 24 * 3600 * 1000);
  if (!p) return out(400, { error: 'job' }, c.headers);

  const view = viewKey(p, secret);
  const db = store(env, deps.fetch);
  const row = await db.get(view);
  if (row) {
    // Le meme dossier, peut-etre relance entre-temps : on garde le plus recent.
    if (row.state === 'awaiting') await db.save(view, { job: p });
    return out(200, { view: view }, c.headers);
  }
  const ok = await db.create({ view_key: view, job: p, state: 'awaiting' });
  if (!ok) return out(502, { error: 'store' }, c.headers);

  // Les photos en lieu sur : les liens KIE expirent en quelques jours, et
  // un client peut payer plus tard.
  if (deps.later) {
    deps.later(Promise.all((p.p || []).map(function (u, n) {
      return db.keep(u, 'photos/' + view + '/' + n, '');
    })));
  }
  return out(200, { view: view }, c.headers);
}

// ------------------------------------------------------------------ VIDEO
/* La page du client demande sa video. Tant que le paiement n'est pas
 * verifie, elle ne recoit rien d'autre qu'un etat. */
export async function doVideo(q, deps) {
  const c = corsFor(q.origin);
  if (q.method === 'OPTIONS') return out(204, null, c.headers);
  if (q.method !== 'POST') return out(405, { error: 'POST only' }, c.headers);
  const env = deps.env;
  if (!c.ok && !trusted(q, env)) return out(403, { error: 'origin' }, c.headers);

  const view = String((q.body && q.body.view) || '').toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(view)) return out(400, { error: 'view' }, c.headers);
  const row = await store(env, deps.fetch).get(view);
  if (!row) return out(404, { state: 'unknown' }, c.headers);

  if (row.state === 'awaiting') return out(200, { state: 'awaiting' }, c.headers);
  if (row.state === 'failed') return out(200, { state: 'failed', order: row.order_name || '' }, c.headers);
  if (row.state !== 'ready') {
    return out(200, Object.assign({ state: 'making', order: row.order_name || '' }, progress(row.shots)), c.headers);
  }
  return out(200, Object.assign({ state: 'ready', order: row.order_name || '' }, playable(row)), c.headers);
}

// ------------------------------------------------------------------- TICK
/* Le minuteur, une fois par minute tant qu'une video est en cours. */
export function tickAllowed(q, env) {
  return trusted(q, env);
}

async function refs(db, row) {
  const job = row.job || {};
  const signed = await Promise.all((job.p || []).map(function (u, n) {
    return db.sign('photos/' + row.view_key + '/' + n, 3 * 24 * 3600);
  }));
  return signed.every(Boolean) && signed.length ? signed : (job.p || []);
}

async function step(row, q, deps, db, k) {
  const view = row.view_key;
  let job = row.job || {};
  let shots = row.shots || [];

  if (row.state === 'paid') {
    const song = await k.songInfo(job.s);
    if (song.state === 'running') { await db.save(view, {}); return 'waiting-song'; }
    if (song.state === 'failed') {
      if (job.fr) { await db.save(view, { state: 'failed', error: 'song' }); return 'failed'; }
      const again = await k.createSong(songPrompt(job.a || {}), q.base + '/callback');
      job = Object.assign({}, job, { s: again || job.s, fr: 1 });
      await db.save(view, { job: job });
      return 'song-again';
    }
    const start = await voiceStart(k, job.s, song);
    const previews = await Promise.all((job.i || []).map(function (id) { return k.imageInfo(id); }));
    const urls = previews.map(function (x) { return x.state === 'done' ? x.url : ''; });
    const photos = await refs(db, row);

    // La chanson chez nous : c'est elle qu'ils garderont.
    let songUrl = song.url;
    const path = 'songs/' + view + '.mp3';
    if (await db.keep(song.url, path, 'audio/mpeg')) {
      songUrl = (await db.sign(path, 5 * 365 * 24 * 3600)) || song.url;
    }
    shots = plan(job, urls, song.duration, start);
    job = Object.assign({}, job, { refs: photos });
    await db.save(view, {
      state: 'making', job: job, shots: shots,
      song_url: songUrl, song_start: start, song_duration: song.duration || null, song_title: song.title || ''
    });
    row = Object.assign({}, row, { state: 'making', job: job, shots: shots });
    // Et on enchaine tout de suite sur les premieres commandes.
    if (!(await db.claim(view, 140))) return 'planned';
  }

  if (row.state === 'making') {
    const age = Date.now() - Date.parse(row.paid_at || row.updated_at || new Date().toISOString());
    const r = await advance(shots, (job.refs && job.refs.length ? job.refs : job.p) || [], k, age);
    if (r.finished) {
      if (anyImage(r.shots)) {
        await db.save(view, { state: 'ready', shots: r.shots, ready_at: new Date().toISOString() });
        return 'ready';
      }
      await db.save(view, { state: 'failed', shots: r.shots, error: 'images' });
      return 'failed';
    }
    await db.save(view, { shots: r.shots });
    return 'making ' + progress(r.shots).done + '/' + r.shots.length;
  }
  await db.save(view, {});
  return 'skip';
}

export async function doTick(q, deps) {
  const env = deps.env;
  if (!trusted(q, env)) return out(401, { error: 'tick' });
  if (!env.KIE_KEY) return out(503, { error: 'not configured' });
  const db = store(env, deps.fetch);
  const k = kie(env, deps.fetch);
  const views = await db.active(4);
  const done = [];
  for (const view of views) {
    const row = await db.claim(view, 140);
    if (!row) { done.push(view.slice(0, 6) + ' busy'); continue; }
    try {
      done.push(view.slice(0, 6) + ' ' + (await step(row, q, deps, db, k)));
    } catch (e) {
      await db.save(view, { error: String((e && e.message) || e).slice(0, 300) });
      done.push(view.slice(0, 6) + ' error');
    }
  }
  return out(200, { rows: done });
}
