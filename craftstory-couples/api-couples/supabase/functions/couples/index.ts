// CraftStory — l'API couples (Supabase Edge Function, Deno).
//
//   POST /functions/v1/couples/start     -> { job, status, eta }            (la preview)
//   POST /functions/v1/couples/status    -> { ready, song, songStart, seconds, beats[6] } ou { ready:false, ... }
//   POST /functions/v1/couples/order     -> { view }   (clic sur payer : le dossier est range, rien n'est genere)
//   POST /functions/v1/couples/video     -> { state, ... }  (la page du client : sa video complete)
//   POST /functions/v1/couples/tick      -> 202        (le minuteur, cle du coffre exigee)
//   POST /functions/v1/couples/callback  -> accuse reception (KIE l'exige pour la chanson)
//
// Secrets : dans le coffre Supabase (kie_key, tick_key), lus par la fonction SQL
// couples_secret() avec la cle du role service. Jamais dans le code.
import { doStart, doStatus, doOrder, doVideo, doTick, tickAllowed } from './lib/core.js';
import { store } from './lib/store.js';

const cache: Record<string, string> = {};

async function environment() {
  const e = {
    SUPABASE_URL: (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, ''),
    SERVICE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    KIE_KEY: Deno.env.get('KIE_KEY') || '',
    TOKEN_SECRET: Deno.env.get('TOKEN_SECRET') || '',
    TICK_KEY: ''
  };
  const db = store(e, fetch);
  if (!e.KIE_KEY) e.KIE_KEY = cache.kie || (cache.kie = await db.secret('kie_key'));
  // Le jeton a son propre secret : changer la cle KIE ne casse aucune commande en cours.
  if (!e.TOKEN_SECRET) e.TOKEN_SECRET = cache.tok || (cache.tok = await db.secret('token_secret'));
  e.TICK_KEY = cache.tick || (cache.tick = await db.secret('tick_key'));
  return e;
}

function later(p: Promise<unknown>) {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') rt.waitUntil(p);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const origin = req.headers.get('origin') || '';
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '?';
  // L'adresse PUBLIQUE de la fonction, pour la page et pour le rappel KIE.
  const pub = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const host = req.headers.get('x-forwarded-host') || url.host;
  const base = (pub || 'https://' + host) + '/functions/v1/couples';

  if (path.endsWith('/callback')) {
    return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
  }

  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch (_e) { body = {}; }
  }
  const env = await environment();
  const q = { method: req.method, origin, ip, base, body, tick: req.headers.get('x-tick') || '' };
  const deps = { env, fetch, later };

  // Le minuteur n'attend pas : la reponse part tout de suite, le travail
  // continue en arriere-plan (pg_net coupe apres quelques secondes).
  if (path.endsWith('/tick')) {
    if (!tickAllowed(q, env)) return new Response('{"error":"tick"}', { status: 401 });
    const work = doTick(q, deps).then((r) => console.log('tick', JSON.stringify(r.body)));
    later(work);
    return new Response('{"ok":true}', { status: 202, headers: { 'Content-Type': 'application/json' } });
  }

  let r;
  if (path.endsWith('/start')) r = await doStart(q, deps);
  else if (path.endsWith('/status')) r = await doStatus(q, deps);
  else if (path.endsWith('/order')) r = await doOrder(q, deps);
  else if (path.endsWith('/video')) r = await doVideo(q, deps);
  else r = { status: 404, body: { error: 'not found' }, headers: { 'Content-Type': 'application/json' } };

  return new Response(r.body == null ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers });
});
