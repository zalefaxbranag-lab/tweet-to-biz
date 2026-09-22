/* Le jeton du travail en cours.
 *
 * L'API ne garde RIEN : ni base, ni fichier, ni cache. Tout ce qu'il faut pour
 * suivre une generation — les identifiants des sept taches KIE, les photos
 * deja deposees, le peu de reponses qu'il faut pour relancer une image — voyage
 * dans ce jeton, entre l'API et l'onglet du client, et nulle part ailleurs.
 *
 * Il est SIGNE : sans ca, n'importe qui pourrait fabriquer un jeton avec les
 * taches d'un autre client et recuperer ses images avec notre cle.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export function secretFrom(env) {
  if (env.TOKEN_SECRET) return env.TOKEN_SECRET;
  // Derive de la cle KIE : un secret de moins a creer, et il change tout seul
  // le jour ou la cle tourne.
  return createHmac('sha256', String(env.KIE_KEY || '')).update('craftstory-couples/token/v1').digest('hex');
}

export function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + mac;
}

export function verify(token, secret, maxAgeMs) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const want = createHmac('sha256', secret).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!p || typeof p !== 'object') return null;
  if (maxAgeMs && (!p.t || Date.now() - p.t > maxAgeMs)) return null;
  return p;
}
