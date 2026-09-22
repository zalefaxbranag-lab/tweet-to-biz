/* L'entree Deno elle-meme, sous Node : on remplace Deno.serve par un piege
 * qui garde le gestionnaire, et on lui envoie de vraies Request. Ca verifie le
 * routage par chemin, la lecture du corps et la reponse — la seule partie que
 * run.mjs ne voit pas. */
let handler = null;
const env = { KIE_KEY: '', SUPABASE_URL: 'https://abc.supabase.co' };
globalThis.Deno = { serve: function (h) { handler = h; }, env: { get: function (k) { return env[k] || ''; } } };
await import('../supabase/functions/couples/index.ts');

let ok = true;
function check(label, got, want) {
  const good = JSON.stringify(got) === JSON.stringify(want);
  ok = ok && good;
  console.log((good ? '  OK   ' : '  FAIL ') + label + '  -> ' + JSON.stringify(got) + (good ? '' : '  (attendu ' + JSON.stringify(want) + ')'));
}
const U = 'https://abc.supabase.co/functions/v1/couples';
const H = { origin: 'https://craftstory.co', 'content-type': 'application/json' };

let r = await handler(new Request(U + '/callback', { method: 'POST', body: '{}' }));
check('le rappel KIE repond 200', [r.status, await r.json()], [200, { ok: true }]);
r = await handler(new Request(U + '/start', { method: 'OPTIONS', headers: H }));
check('le pre-vol', [r.status, r.headers.get('access-control-allow-origin')], [204, 'https://craftstory.co']);
r = await handler(new Request(U + '/start', { method: 'POST', headers: H, body: '{}' }));
check('sans cle : 503, rien ne part', [r.status, (await r.json()).error], [503, 'not configured']);
env.KIE_KEY = 'test-key-not-real';
r = await handler(new Request(U + '/start', { method: 'POST', headers: H, body: 'pas du json' }));
check('un corps illisible : 400 photo', [r.status, (await r.json()).error], [400, 'photo']);
r = await handler(new Request(U + '/status', { method: 'POST', headers: H, body: JSON.stringify({ job: 'x.y' }) }));
check('un jeton faux : 400', r.status, 400);
r = await handler(new Request(U + '/rien', { method: 'POST', headers: H, body: '{}' }));
check('un autre chemin : 404', r.status, 404);
r = await handler(new Request(U + '/start/', { method: 'OPTIONS', headers: H }));
check('la barre finale est toleree', r.status, 204);

// L'adresse de suivi renvoyee a la page vient de SUPABASE_URL, pas de l'hote
// interne : on appelle depuis une URL « interne » et on regarde ce qui revient.
const realFetch = globalThis.fetch;
globalThis.fetch = async function (u, init) {
  const s = String(u);
  const J = function (x) { return new Response(JSON.stringify(x), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  if (s.indexOf('upload') > -1) return J({ code: 200, data: { downloadUrl: 'https://kie.files/x.jpg' } });
  if (s.endsWith('/generate')) { globalThis.__cb = JSON.parse(init.body).callBackUrl; return J({ code: 200, data: { taskId: 's1' } }); }
  if (s.endsWith('/createTask')) return J({ code: 200, data: { taskId: 'i1' } });
  return J({ code: 200, data: null });
};
const photo = 'data:image/jpeg;base64,' + Buffer.from('x').toString('base64');
r = await handler(new Request('http://localhost:9000/couples/start', { method: 'POST', headers: H,
  body: JSON.stringify({ photo: photo, email: 'a@craftstory.co', their_name: 'Marie' }) }));
const got = await r.json();
check('la page recoit l\'adresse publique de suivi', got.status, 'https://abc.supabase.co/functions/v1/couples/status');
check('KIE recoit l\'adresse publique de rappel', globalThis.__cb, 'https://abc.supabase.co/functions/v1/couples/callback');
globalThis.fetch = realFetch;
console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHECS CI-DESSUS'));
process.exit(ok ? 0 : 1);
