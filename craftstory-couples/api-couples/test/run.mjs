/* L'API de bout en bout, contre un faux KIE. Zero credit, zero reseau.
 *
 *     node test/run.mjs
 *
 * Le faux KIE se comporte comme le vrai d'apres le worker en production : il
 * rend un taskId a la creation, fait patienter quelques tours, puis rend
 * successFlag 1 et une URL — ou 3 quand on lui demande d'echouer.
 */
import { doStart, doStatus } from '../supabase/functions/couples/lib/core.js';
import { songPrompt, scenes } from '../supabase/functions/couples/lib/brief.js';
import { sign, verify, secretFrom } from '../supabase/functions/couples/lib/token.js';

// Le meme appel que la fonction Deno fait, sans Deno : une demande deja lue,
// une reponse { status, body, headers }.
const BASE = 'https://api.test/functions/v1/couples';
const start = 'start';
const status = 'status';

let ok = true;
function check(label, got, want) {
  const good = JSON.stringify(got) === JSON.stringify(want);
  ok = ok && good;
  console.log((good ? '  OK   ' : '  FAIL ') + label + '  -> ' + JSON.stringify(got)
    + (good ? '' : '  (attendu ' + JSON.stringify(want) + ')'));
}

// ---------------------------------------------------------------- le faux KIE
function fakeKie(opts) {
  const o = Object.assign({ imgTurns: 2, songTurns: 3, failImg: {}, failSong: 0, words: true }, opts || {});
  const st = { tasks: {}, n: 0, calls: [], prompts: {} };
  async function f(url, init) {
    const u = String(url);
    const body = init && init.body ? JSON.parse(init.body) : null;
    st.calls.push({ url: u, body: body, auth: init && init.headers && init.headers.Authorization });
    const J = function (x, code) {
      return { ok: (code || 200) < 400, status: code || 200, json: async function () { return x; } };
    };
    if (u.indexOf('file-base64-upload') > -1) {
      return J({ code: 200, data: { downloadUrl: 'https://kie.files/' + body.fileName } });
    }
    if (u.endsWith('/jobs/createTask')) {
      const id = 'img' + (++st.n);
      const slot = Object.keys(st.tasks).filter(function (k) { return k.indexOf('img') === 0; }).length;
      st.tasks[id] = { turns: 0, kind: 'img', fail: o.failImg[st.n] || 0 };
      st.prompts[id] = body.input.prompt;
      void slot;
      return J({ code: 200, data: { taskId: id } });
    }
    if (u.indexOf('/jobs/recordInfo') > -1) {
      const id = new URL(u).searchParams.get('taskId');
      const t = st.tasks[id];
      if (!t) return J({ code: 200, data: null });
      t.turns++;
      if (t.fail) return J({ code: 200, data: { successFlag: 3, failMsg: 'flagged' } });
      if (t.turns < o.imgTurns) return J({ code: 200, data: { successFlag: 0 } });
      return J({ code: 200, data: { successFlag: 1, resultJson: JSON.stringify({ resultUrls: ['https://kie.out/' + id + '.png'] }) } });
    }
    if (u.endsWith('/generate')) {
      const id = 'song' + (++st.n);
      st.tasks[id] = { turns: 0, kind: 'song', fail: (st.songsMade || 0) < o.failSong };
      st.songsMade = (st.songsMade || 0) + 1;
      st.songPrompt = body.prompt;
      st.songBody = body;
      return J({ code: 200, data: { taskId: id } });
    }
    if (u.indexOf('/generate/record-info') > -1) {
      const id = new URL(u).searchParams.get('taskId');
      const t = st.tasks[id];
      t.turns++;
      if (t.fail) return J({ code: 200, data: { status: 'GENERATE_AUDIO_FAILED' } });
      if (t.turns < o.songTurns) {
        return J({ code: 200, data: { status: 'TEXT_SUCCESS', response: { sunoData: [{ id: 'a1', streamAudioUrl: 'https://kie.stream/' + id }] } } });
      }
      return J({ code: 200, data: { status: 'FIRST_SUCCESS', response: { sunoData: [
        { id: 'a1', audioUrl: 'https://kie.audio/' + id + '.mp3', duration: 184.2, title: "Marie's Song", prompt: '[Verse]\n...' },
        { id: 'a2', streamAudioUrl: 'https://kie.stream/2' }] } } });
    }
    if (u.indexOf('get-timestamped-lyrics') > -1) {
      if (!o.words) return J({ code: 404, msg: 'no' }, 404);
      return J({ code: 200, data: { alignedWords: [{ word: 'Ten ', startS: 3.4, endS: 3.8 }, { word: 'years', startS: 3.8, endS: 4.2 }] } });
    }
    return J({ code: 404 }, 404);
  }
  return { fetch: f, st: st };
}

// ------------------------------------------------------------ fausse demande
function req(method, body, origin, ip) {
  return {
    method: method,
    origin: origin === undefined ? 'https://craftstory.co' : origin,
    ip: ip || '1.2.3.' + Math.floor(Math.random() * 250),
    base: BASE,
    body: body
  };
}
async function call(which, q, deps) {
  const r = which === 'start' ? await doStart(q, deps) : await doStatus(q, deps);
  return {
    statusCode: r.status,
    headers: Object.fromEntries(Object.entries(r.headers || {}).map(function (e) { return [e[0].toLowerCase(), e[1]]; })),
    json: function () { return r.body; }
  };
}

const ENV = { KIE_KEY: 'test-key-not-real' };
const PHOTO = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
const A = {
  their_name: 'Marie', your_name: 'Thomas', relationship: 'Wife', occasion: 'Anniversary',
  genre: 'Soul / R&B', voice: 'Duet', language: 'English', email: 'thomas@craftstory.co',
  story: 'We missed the same train in Lyon in 2019 and waited two hours on the platform.',
  qualities: 'She laughs before the punchline.', message: 'I would miss that train again.',
  consent: 'Yes', photo: PHOTO, photo2: PHOTO, photo_count: 2
};

console.log('\n--- LES PORTES ---');
{
  const kk = fakeKie();
  let r = await call(start, req('OPTIONS', null), { env: ENV, fetch: kk.fetch });
  check('le pre-vol repond 204', r.statusCode, 204);
  check('et autorise la boutique', r.headers['access-control-allow-origin'], 'https://craftstory.co');
  r = await call(start, req('POST', A, 'https://evil.example'), { env: ENV, fetch: kk.fetch });
  check('un autre site est refuse', r.statusCode, 403);
  r = await call(start, req('POST', A, 'https://fzddaf-k8.myshopify.com'), { env: ENV, fetch: kk.fetch });
  check('le domaine myshopify passe', r.statusCode, 200);
  r = await call(start, req('POST', A), { env: {}, fetch: kk.fetch });
  check('sans cle, 503 et aucun appel', [r.statusCode, r.json().error], [503, 'not configured']);
  r = await call(start, req('GET', null), { env: ENV, fetch: kk.fetch });
  check('GET refuse', r.statusCode, 405);
  r = await call(start, req('POST', Object.assign({}, A, { photo: '', photo2: '' })), { env: ENV, fetch: kk.fetch });
  check('sans photo, 400', [r.statusCode, r.json().error], [400, 'photo']);
  r = await call(start, req('POST', Object.assign({}, A, { photo: 'data:text/html;base64,PHNjcmlwdD4=', photo2: '' })), { env: ENV, fetch: kk.fetch });
  check('un faux dataURL est refuse', [r.statusCode, r.json().error], [400, 'photo']);
  r = await call(start, req('POST', Object.assign({}, A, { email: 'nope' })), { env: ENV, fetch: kk.fetch });
  check('e-mail invalide, 400', [r.statusCode, r.json().error], [400, 'email']);
}

console.log('\n--- LE LANCEMENT ---');
const kk = fakeKie();
let r = await call(start, req('POST', A), { env: ENV, fetch: kk.fetch });
check('200', r.statusCode, 200);
const first = r.json();
check('un jeton', typeof first.job, 'string');
check("l'adresse de suivi", first.status, BASE + '/status');
const ups = kk.st.calls.filter(function (x) { return x.url.indexOf('upload') > -1; });
check('deux photos deposees', ups.length, 2);
check('la cle part en en-tete', ups[0].auth, 'Bearer test-key-not-real');
const tasks = kk.st.calls.filter(function (x) { return x.url.endsWith('/jobs/createTask'); });
check('six images lancees', tasks.length, 6);
check('toutes sur nano-banana-pro', tasks.every(function (t) { return t.body.model === 'nano-banana-pro'; }), true);
check('avec image_input, pas image_urls', tasks.every(function (t) { return Array.isArray(t.body.input.image_input) && !t.body.input.image_urls; }), true);
check('les deux photos en reference', tasks[0].body.input.image_input, ['https://kie.files/' + ups[0].body.fileName, 'https://kie.files/' + ups[1].body.fileName]);
check('en 16:9', tasks[0].body.input.aspect_ratio, '16:9');
const songCall = kk.st.calls.find(function (x) { return x.url.endsWith('/generate'); });
check('une chanson lancee', !!songCall, true);
check('chanson complete, paroles ecrites par Suno', [songCall.body.customMode, songCall.body.instrumental, songCall.body.model], [false, false, 'V5']);
check('avec une adresse de rappel', songCall.body.callBackUrl, BASE + '/callback');
check('le brief tient sous 500', songCall.body.prompt.length < 500, true);
for (const w of ['Marie', 'Thomas', 'wife', 'anniversary', 'soul', 'duet', 'English', 'train in Lyon', 'punchline', 'miss that train again']) {
  check('le brief porte « ' + w + ' »', songCall.body.prompt.indexOf(w) > -1, true);
}

console.log('\n--- LE JETON ---');
const secret = secretFrom(ENV);
const decoded = verify(first.job, secret);
check('il se relit', !!decoded, true);
check('il porte les six images', decoded.i.length, 6);
check('et les photos deposees', decoded.p.length, 2);
check('mais pas les photos elles-memes', first.job.indexOf('ZmFrZS1qcGVn') < 0, true);
const forged = first.job.slice(0, -3) + 'abc';
r = await call(status, req('POST', { job: forged }), { env: ENV, fetch: kk.fetch });
check('un jeton retouche est refuse', [r.statusCode, r.json().error], [400, 'job']);
const other = sign(decoded, 'une-autre-cle');
r = await call(status, req('POST', { job: other }), { env: ENV, fetch: kk.fetch });
check('un jeton signe ailleurs est refuse', r.statusCode, 400);

console.log('\n--- LE SUIVI ---');
r = await call(status, req('POST', { job: first.job }), { env: ENV, fetch: kk.fetch });
let s1 = r.json();
check('pas encore pret', s1.ready, false);
check('compte sur sept', s1.of, 7);
r = await call(status, req('POST', { job: s1.job }), { env: ENV, fetch: kk.fetch });
s1 = r.json();
check('les images arrivent avant la chanson', [s1.ready, s1.done], [false, 6]);
r = await call(status, req('POST', { job: s1.job }), { env: ENV, fetch: kk.fetch });
const fin = r.json();
check('pret', fin.ready, true);
check('la chanson complete', fin.song.indexOf('https://kie.audio/') === 0, true);
check('trente secondes', fin.seconds, 30);
check('six plans', fin.beats.length, 6);
check('de cinq secondes chacun', fin.beats.map(function (b) { return b.dur; }), [5, 5, 5, 5, 5, 5]);
check('poses bout a bout', fin.beats.map(function (b) { return b.at; }), [0, 5, 10, 15, 20, 25]);
check('six images differentes', new Set(fin.beats.map(function (b) { return b.poster; })).size, 6);
check('des images fixes, pas des clips', fin.beats.every(function (b) { return b.clip === ''; }), true);
check('un leger zoom qui alterne', fin.beats.map(function (b) { return b.drift; }), ['in', 'out', 'in', 'out', 'in', 'out']);
check('la preview demarre sur la voix', fin.songStart, 3);
check("les photos pour l'atelier", fin.photos.length, 2);

console.log('\n--- SANS HORODATAGE, ON DEMARRE A ZERO ---');
{
  const k2 = fakeKie({ words: false, imgTurns: 1, songTurns: 1 });
  const j = (await call(start, req('POST', A), { env: ENV, fetch: k2.fetch })).json().job;
  const f2 = (await call(status, req('POST', { job: j }), { env: ENV, fetch: k2.fetch })).json();
  check('pret quand meme', f2.ready, true);
  check('depart a zero', f2.songStart, 0);
}

console.log('\n--- UNE IMAGE REFUSEE : UNE RELANCE, SANS LEURS MOTS ---');
{
  // La tache n°2 cree (la premiere image) echoue.
  const k3 = fakeKie({ failImg: { 2: 1 }, imgTurns: 1, songTurns: 1 });
  const j = (await call(start, req('POST', A), { env: ENV, fetch: k3.fetch })).json().job;
  const s = (await call(status, req('POST', { job: j }), { env: ENV, fetch: k3.fetch })).json();
  check('pas encore pret : la relance tourne', s.ready, false);
  check('le jeton a change', s.job !== j, true);
  const retried = Object.keys(k3.st.prompts).pop();
  check('la relance ne porte plus leur histoire', k3.st.prompts[retried].indexOf('train in Lyon') < 0, true);
  check('mais garde les memes photos', k3.st.calls.filter(function (x) { return x.url.endsWith('/createTask'); }).pop().body.input.image_input.length, 2);
  const s2 = (await call(status, req('POST', { job: s.job }), { env: ENV, fetch: k3.fetch })).json();
  check('pret apres la relance', s2.ready, true);
  check('six images', new Set(s2.beats.map(function (b) { return b.poster; })).size, 6);
}

console.log('\n--- DEUX REFUS : LA PLACE EST COMBLEE ---');
{
  const k4 = fakeKie({ failImg: { 2: 1, 8: 1 }, imgTurns: 1, songTurns: 1 });
  const j = (await call(start, req('POST', A), { env: ENV, fetch: k4.fetch })).json().job;
  const s = (await call(status, req('POST', { job: j }), { env: ENV, fetch: k4.fetch })).json();
  const s2 = (await call(status, req('POST', { job: s.job }), { env: ENV, fetch: k4.fetch })).json();
  check('pret quand meme', s2.ready, true);
  check('toujours six plans', s2.beats.length, 6);
  check('aucun plan vide', s2.beats.every(function (b) { return !!b.poster; }), true);
  check('cinq images distinctes, une reprise', new Set(s2.beats.map(function (b) { return b.poster; })).size, 5);
}

console.log('\n--- LA CHANSON PERDUE : UNE RELANCE, PUIS LE REPLI ---');
{
  const k5 = fakeKie({ failSong: 2, imgTurns: 1, songTurns: 1 });
  const j = (await call(start, req('POST', A), { env: ENV, fetch: k5.fetch })).json().job;
  const s = (await call(status, req('POST', { job: j }), { env: ENV, fetch: k5.fetch })).json();
  check('premiere perte : relance', [s.ready, s.failed || false], [false, false]);
  check('une seconde chanson lancee', k5.st.songsMade, 2);
  const s2 = (await call(status, req('POST', { job: s.job }), { env: ENV, fetch: k5.fetch })).json();
  check('seconde perte : la page passe a son repli', [s2.ready, s2.failed], [false, true]);
  check('pas de troisieme essai', k5.st.songsMade, 2);
}

console.log('\n--- LE GARDE-FOU ---');
{
  const k6 = fakeKie();
  const codes = [];
  for (let n = 0; n < 7; n++) codes.push((await call(start, req('POST', A, undefined, '9.9.9.9'), { env: ENV, fetch: k6.fetch })).statusCode);
  check('cinq lancements, puis 429', codes, [200, 200, 200, 200, 200, 429, 429]);
}

console.log('\n--- LE BRIEF ET LES SCENES ---');
check('jamais plus de 499 caracteres', songPrompt(Object.assign({}, A, { story: 'a '.repeat(2000), qualities: 'b '.repeat(900), message: 'c '.repeat(800) })).length <= 499, true);
check('la langue choisie est demandee', songPrompt(Object.assign({}, A, { language: 'French' })).indexOf('in French') > -1, true);
check('« les deux » devient une chanson sur eux deux', songPrompt(Object.assign({}, A, { relationship: 'The two of us' })).indexOf('about Thomas and Marie') > -1, true);
const sc = scenes(A, 2);
check('six scenes', sc.map(function (x) { return x.k; }), ['meet', 'falling', 'special', 'home', 'moment', 'forever']);
check("la scene 1 porte leur histoire", sc[0].prompt.indexOf('train in Lyon') > -1, true);
check("la scene 3 porte ce qu'ils aiment", sc[2].prompt.indexOf('punchline') > -1, true);
check("la scene 5 dit l'occasion", sc[4].prompt.indexOf('anniversary') > -1, true);
check('une photo seule : « la photo montre le couple »', scenes(A, 1)[0].prompt.indexOf('The reference photo shows the couple') === 0, true);
const BANNED = ['blonde', 'brunette', 'blue eyes', 'brown eyes', 'green eyes', 'years old', 'caucasian', 'asian', 'african', 'beautiful woman', 'handsome man', 'slim', 'tall man'];
check('aucune description de visage, jamais', sc.map(function (x) { return BANNED.filter(function (w) { return x.prompt.toLowerCase().indexOf(w) > -1; }); }).flat(), []);
check('les mots interdits du projet', sc.some(function (x) { return /\b(movie|film)\b/i.test(x.prompt.replace('film still', '').replace('film grain', '')); }), false);

console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHECS CI-DESSUS'));
process.exit(ok ? 0 : 1);
