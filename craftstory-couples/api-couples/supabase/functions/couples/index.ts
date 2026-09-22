// CraftStory — l'API de la preview couples (Supabase Edge Function, Deno).
//
//   POST /functions/v1/couples/start     -> { job, status, eta }
//   POST /functions/v1/couples/status    -> { ready, song, songStart, seconds, beats[6] } ou { ready:false, ... }
//   POST /functions/v1/couples/callback  -> accuse reception (KIE l'exige pour la chanson)
//
// Secret : KIE_KEY (Supabase > Edge Functions > Secrets). Rien d'autre.
// La fonction ne garde rien : tout l'etat voyage dans un jeton signe.
import { doStart, doStatus } from './lib/core.js';

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const origin = req.headers.get('origin') || '';
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '?';
  // L'adresse PUBLIQUE de la fonction, pour la page et pour le rappel KIE.
  // Supabase la fournit (SUPABASE_URL) : l'hote vu de l'interieur peut etre
  // une adresse interne, et KIE refuserait un rappel qu'il ne peut pas joindre.
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
  const q = { method: req.method, origin, ip, base, body };
  const deps = { env: { KIE_KEY: Deno.env.get('KIE_KEY') || '', TOKEN_SECRET: Deno.env.get('TOKEN_SECRET') || '' }, fetch };

  let r;
  if (path.endsWith('/start')) r = await doStart(q, deps);
  else if (path.endsWith('/status')) r = await doStatus(q, deps);
  else r = { status: 404, body: { error: 'not found' }, headers: { 'Content-Type': 'application/json' } };

  return new Response(r.body == null ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers });
});
