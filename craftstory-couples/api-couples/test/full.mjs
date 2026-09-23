// La video payee, de bout en bout, contre un faux KIE et une fausse base :
// clic « payer » -> dossier range -> paiement marque -> minuteur -> video prete.
import { doStart, doOrder, doVideo, doTick, viewKey } from '../supabase/functions/couples/lib/core.js';
import { timeline, plan, advance, playable } from '../supabase/functions/couples/lib/full.js';
import { fullScenes } from '../supabase/functions/couples/lib/brief.js';
import { verify, secretFrom } from '../supabase/functions/couples/lib/token.js';

let bad = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log((ok ? '  OK   ' : '  FAIL ') + label + '  -> ' + JSON.stringify(got) + (ok ? '' : '  (attendu ' + JSON.stringify(want) + ')'));
}

// ---- decoupage
const t = timeline(183.4, 8.2);
check('premier plan = intro + 5 s', t[0], { at: 0, dur: 13.2 });
check('plans 2 a 6 toutes les 5 s depuis la voix', t.slice(1, 6).map(x => x.at), [13.2, 18.2, 23.2, 28.2, 33.2]);
check('la suite demarre a la fin de la preview', t[6].at, 38.2);
check('le dernier plan finit avec la chanson', Math.round((t[t.length - 1].at + t[t.length - 1].dur) * 10) / 10, 183.4);
check('aucun plan hors 4-6 s apres la preview', t.slice(6).every(x => x.dur >= 4 && x.dur <= 6), true);
check('jamais plus de 60 plans', timeline(900, 0).length, 60);
check('chanson plus courte que la preview : coupee', timeline(20, 0).map(x => x.at), [0, 5, 10, 15]);

// ---- scenes
const a = { their_name: 'Sam', your_name: 'Alex', occasion: 'Anniversary', qualities: 'the way Sam laughs at my worst jokes', genre: 'Pop', voice: 'Male', language: 'English' };
const fs = fullScenes(a, 30, 2);
check('30 scenes', fs.length, 30);
check('le final est le dernier plan', /cheek to cheek/.test(fs[29].prompt), true);
check('l occasion vers les trois quarts', /anniversary/.test(fs[22].prompt), true);
check('ce qu ils aiment au milieu', /laughs at my worst jokes/.test(fs[15].prompt), true);
check('la version sure n a pas leurs mots', /worst jokes/.test(fs[15].safe), false);
check('jamais de visage decrit', fs.some(s => /\b(blue|brown|green) eyes|blond|beard|freckles/i.test(s.prompt)), false);
check('le mouvement garde les visages', /Keep both faces exactly/.test(fs[3].motion), true);
check('memes prenoms, meme film', fullScenes(a, 30, 2)[4].prompt === fs[4].prompt, true);

// ---- faux KIE + fausse base
const DB = new Map();
let n = 0;
const tasks = new Map();   // id -> { polls, fail }
let failNext = 0;
let failImg = '-';
const created = { image: 0, video: 0, song: 0 };
function json(status, body) { return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: new Map([['content-type', 'audio/mpeg']]), arrayBuffer: async () => new ArrayBuffer(8) }; }
const fakeFetch = async (url, init) => {
  const u = String(url);
  const body = init && init.body && typeof init.body === 'string' ? JSON.parse(init.body) : null;
  if (u.includes('/rest/v1/rpc/couples_secret')) return json(200, 'k-' + body.p_name);
  if (u.includes('/rest/v1/couples_orders')) {
    const m = /view_key=eq\.([a-f0-9]+)/.exec(u);
    const method = (init && init.method) || 'GET';
    if (method === 'POST') { if (!DB.has(body.view_key)) DB.set(body.view_key, Object.assign({ state: 'awaiting', shots: [], created_at: new Date().toISOString() }, body)); return json(201, null); }
    if (method === 'PATCH') {
      const row = DB.get(m[1]);
      if (!row) return json(200, []);
      if (u.includes('&or=') && row.lease_until && Date.parse(row.lease_until) > Date.now()) return json(200, []);
      Object.assign(row, body);
      return json(200, [row]);
    }
    if (m) return json(200, DB.has(m[1]) ? [DB.get(m[1])] : []);
    if (u.includes('state=in.(paid,making)')) return json(200, [...DB.values()].filter(r => r.state === 'paid' || r.state === 'making').map(r => ({ view_key: r.view_key })));
    return json(200, []);
  }
  if (u.includes('/storage/v1/object/sign/')) return json(200, { signedURL: '/object/sign/couples/' + u.split('/couples/')[1] + '?token=x' });
  if (u.includes('/storage/v1/object/')) return json(200, { Key: 'x' });
  if (u.startsWith('https://kie/') && !(init && init.method)) return json(200, {});
  if (u.includes('file-base64-upload')) return json(200, { code: 200, data: { downloadUrl: 'https://kie/photo' + (++n) + '.jpg' } });
  if (u.endsWith('/generate')) { created.song++; return json(200, { code: 200, data: { taskId: 'song' + (++n) } }); }
  if (u.includes('/generate/record-info')) return json(200, { code: 200, data: { status: 'SUCCESS', response: { sunoData: [{ id: 'a1', audioUrl: 'https://kie/song.mp3', duration: 95.5, title: 'Sam' }] } } });
  if (u.includes('get-timestamped-lyrics')) return json(200, { code: 200, data: { alignedWords: [{ word: 'Sam', startS: 6.4 }] } });
  if (u.endsWith('/jobs/createTask')) {
    const kind = body.model.startsWith('kling') ? 'video' : 'image';
    created[kind]++;
    if (failNext > 0) { failNext--; return json(200, { code: 429, msg: 'rate' }); }
    const id = kind + (++n);
    // Le troisieme clip echoue, et sa relance aussi (meme image de depart).
    const img = kind === 'video' ? body.input.image_urls[0] : '';
    if (kind === 'video' && created.video === 3) failImg = img;
    tasks.set(id, { polls: 0, kind, fail: kind === 'video' && img === failImg });
    return json(200, { code: 200, data: { taskId: id } });
  }
  if (u.includes('/jobs/recordInfo')) {
    const id = new URL(u).searchParams.get('taskId');
    const tk = tasks.get(id);
    if (!tk) return json(200, { code: 200, data: { successFlag: 0 } });
    tk.polls++;
    if (tk.polls < 2) return json(200, { code: 200, data: { successFlag: 0 } });
    if (tk.fail) return json(200, { code: 200, data: { successFlag: 3 } });
    return json(200, { code: 200, data: { successFlag: 1, resultJson: JSON.stringify({ resultUrls: ['https://kie/' + id + (tk.kind === 'video' ? '.mp4' : '.png')] }) } });
  }
  return json(404, {});
};

const env = { KIE_KEY: 'k', TOKEN_SECRET: '', TICK_KEY: 'tk', SUPABASE_URL: 'https://p.supabase.co', SERVICE_KEY: 's' };
const bg = [];
const deps = { env, fetch: fakeFetch, later: p => bg.push(p) };
const base = 'https://p.supabase.co/functions/v1/couples';
const shop = 'https://craftstory.co';

const photo = 'data:image/jpeg;base64,' + 'A'.repeat(200);
const st = await doStart({ method: 'POST', origin: shop, ip: '1', base, body: Object.assign({ photo, email: 'test@craftstory.co' }, a) }, deps);
check('la preview part', st.status, 200);
// Les six images de la preview se terminent.
for (const id of verify(st.body.job, secretFrom(env)).i) { tasks.get(id).polls = 5; }

const o = await doOrder({ method: 'POST', origin: shop, ip: '1', base, body: { job: st.body.job } }, deps);
check('payer range le dossier', o.status, 200);
check('une cle privee de 24 caracteres', /^[a-f0-9]{24}$/.test(o.body.view), true);
const o2 = await doOrder({ method: 'POST', origin: shop, ip: '1', base, body: { job: st.body.job } }, deps);
check('deux clics, une seule commande', [o2.body.view === o.body.view, DB.size], [true, 1]);
check('un faux jeton est refuse', (await doOrder({ method: 'POST', origin: shop, ip: '1', base, body: { job: st.body.job + 'x' } }, deps)).status, 400);
check('un autre site est refuse', (await doOrder({ method: 'POST', origin: 'https://evil.com', ip: '1', base, body: { job: st.body.job } }, deps)).status, 403);
await Promise.all(bg);

const view = o.body.view;
const v0 = await doVideo({ method: 'POST', origin: shop, body: { view } }, deps);
check('avant paiement : rien que l etat', v0.body, { state: 'awaiting' });
check('une cle inconnue', (await doVideo({ method: 'POST', origin: shop, body: { view: 'a'.repeat(24) } }, deps)).status, 404);

// Le minuteur ne fait rien tant que ce n'est pas paye.
const imagesBefore = created.image;
await doTick({ method: 'POST', tick: 'tk', base, body: {} }, deps);
check('pas paye : aucune generation', created.image, imagesBefore);
check('un minuteur sans cle est refuse', (await doTick({ method: 'POST', tick: 'nope', base, body: {} }, deps)).status, 401);

// Le paiement (ce que fait couples_paid() en SQL).
Object.assign(DB.get(view), { state: 'paid', order_id: 'gid://shopify/Order/1', order_name: '#1001', paid_at: new Date().toISOString() });
failNext = 2;   // KIE refuse deux commandes : on doit reessayer, pas abandonner
let ticks = 0;
while (DB.get(view).state !== 'ready' && ticks < 40) {
  await doTick({ method: 'POST', tick: 'tk', base, body: {} }, deps);
  DB.get(view).lease_until = null;
  ticks++;
  if (ticks === 2) {
    const mid = await doVideo({ method: 'POST', origin: shop, body: { view } }, deps);
    check('pendant : la page voit l avancement', [mid.body.state, mid.body.of > 6], ['making', true]);
  }
}
const row = DB.get(view);
check('la video est prete', row.state, 'ready');
check('en quelques passages', ticks <= 12, true);
check('la chanson est gardee chez nous', /\/storage\/v1\/object\/sign\/couples\/songs\//.test(row.song_url), true);
check('depart sur la voix', Number(row.song_start), 6);
check('un plan toutes les ~5 s jusqu a la fin', row.shots.length, timeline(95.5, 6).length);
check('les six premiers plans reprennent la preview', row.shots.slice(0, 6).every(x => /image\d+\.png$/.test(x.img)), true);
check('les nouvelles images utilisent les photos rangees', /storage\/v1\/object\/sign\/couples\/photos\//.test(row.job.refs[0]), true);
const v = await doVideo({ method: 'POST', origin: shop, body: { view } }, deps);
check('la page recoit toute la video', [v.body.state, v.body.order, v.body.beats.length], ['ready', '#1001', row.shots.length]);
check('chaque plan a une image', v.body.beats.every(b => !!b.poster), true);
check('les clips animes sont la', v.body.beats.filter(b => /\.mp4$/.test(b.clip)).length >= row.shots.length - 1, true);
check('un clip rate deux fois reste une image fixe', v.body.beats.some(b => !b.clip && b.poster), true);

// Un plan dont l'image est perdue emprunte celle du voisin.
const p2 = playable({ shots: [{ at: 0, dur: 5, img: 'a.png', vid: 'a.mp4' }, { at: 5, dur: 5, img: '', di: 1 }, { at: 10, dur: 5, img: 'c.png', vid: '' }] });
check('trou comble par le voisin', p2.beats.map(b => b.poster), ['a.png', 'a.png', 'c.png']);

// Au-dela de 40 minutes, on livre ce qui est pret.
const late = await advance([{ at: 0, dur: 5, img: 'x.png', vt: 'nope', vtry: 1, vid: '', cf: 0 }], ['r'], { imageInfo: async () => ({ state: 'running' }), createImage: async () => '', createVideo: async () => '' }, 41 * 60 * 1000);
check('apres 40 min : livre quand meme', late.finished, true);

console.log(bad ? '\n' + bad + ' ECHEC(S)' : '\nTOUT PASSE');
process.exit(bad ? 1 : 0);
