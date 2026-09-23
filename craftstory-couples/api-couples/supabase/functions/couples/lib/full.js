/* LA VIDEO PAYEE, du debut a la fin de la chanson.
 *
 * Meme regle que la preview : la chanson d'abord, les images ensuite, un plan
 * tous les cinq secondes environ. Les trente premieres secondes SONT la
 * preview (memes six images, meme depart sur la voix) ; la suite continue
 * l'histoire jusqu'a la derniere note. Chaque image devient la premiere image
 * d'un clip Kling de cinq secondes.
 *
 * Le travail avance par petits pas : a chaque passage du minuteur (une fois
 * par minute), on relit ou en est chaque tache chez KIE, puis on en commande
 * quelques nouvelles. Rien n'attend rien : une image en retard ne bloque pas
 * les autres, et un plan qui echoue deux fois reste une image fixe qui zoome
 * doucement — la video part toujours complete.
 */
import { scenes, fullScenes } from './brief.js';

export const PER = 5;
export const MAX_SHOTS = 60;
export const CREATES_PER_TICK = 16;
// Au-dela, on livre avec ce qui est pret : un plan sans clip reste une image.
export const GIVE_UP = 40 * 60 * 1000;

const r2 = function (x) { return Math.round(x * 100) / 100; };

/* Le decoupage. Le premier plan couvre l'intro jusqu'a la voix plus cinq
 * secondes, exactement comme la preview qui demarre sur la voix. */
export function timeline(duration, start) {
  const s = Math.max(0, Math.min(20, Number(start) || 0));
  const D = Number(duration) > 0 ? Number(duration) : 180;
  const out = [{ at: 0, dur: s + PER }];
  for (let n = 1; n < 6; n++) out.push({ at: s + n * PER, dur: PER });
  const t = s + 6 * PER;
  const room = D - t;
  if (room > 1) {
    const slots = Math.min(MAX_SHOTS - 6, Math.max(1, Math.round(room / PER)));
    const per = room / slots;
    for (let n = 0; n < slots; n++) out.push({ at: t + n * per, dur: per });
  }
  // Une chanson plus courte que la preview : on coupe ce qui depasse.
  return out.filter(function (x) { return x.at < D; }).map(function (x) {
    return { at: r2(x.at), dur: r2(Math.min(x.dur, D - x.at)) };
  });
}

/* Le plan de tournage : un plan par tranche, avec son prompt, et les six
 * images de la preview deja faites pour les six premiers. */
export function plan(job, previewUrls, duration, start) {
  const cuts = timeline(duration, start);
  const photoCount = (job.p || []).length || 1;
  const first = scenes(job.a || {}, photoCount);
  const rest = fullScenes(job.a || {}, Math.max(0, cuts.length - 6), photoCount);
  return cuts.map(function (c, n) {
    const s = n < 6 ? first[n] : rest[n - 6];
    return {
      at: c.at, dur: c.dur,
      p: s.prompt, s: s.safe, m: s.motion,
      img: (n < 6 && previewUrls[n]) || '', it: '', itry: 0,
      vid: '', vt: '', vtry: 0,
      cf: 0, di: 0, dv: 0
    };
  });
}

function settled(x) { return !!(x.vid || x.di || (x.img && x.dv)); }

export function progress(shots) {
  const list = shots || [];
  return { done: list.filter(settled).length, of: list.length };
}

async function each(list, width, fn) {
  let i = 0;
  const run = async function () { while (i < list.length) { const x = list[i++]; await fn(x); } };
  const lanes = [];
  for (let k = 0; k < Math.min(width, list.length); k++) lanes.push(run());
  await Promise.all(lanes);
}

/* Un pas. Rend { shots, finished }. */
export async function advance(shotsIn, photos, k, age) {
  const shots = shotsIn.map(function (x) { return Object.assign({}, x); });

  // 1. Ou en sont les taches deja lancees.
  await each(shots.filter(function (x) { return x.it || x.vt; }), 8, async function (x) {
    if (x.it) {
      const r = await k.imageInfo(x.it);
      if (r.state === 'done') { x.img = r.url; x.it = ''; }
      else if (r.state === 'failed') { x.it = ''; if (x.itry >= 2) x.di = 1; }
    }
    if (x.vt) {
      const r = await k.imageInfo(x.vt);
      if (r.state === 'done') { x.vid = r.url; x.vt = ''; }
      else if (r.state === 'failed') { x.vt = ''; if (x.vtry >= 2) x.dv = 1; }
    }
  });

  // 2. Les nouvelles commandes, dans l'ordre du film : le debut est pret
  // en premier. Un refus de KIE a la commande (cadence, credits) n'est pas un
  // echec du plan : on reessaie au passage suivant, six fois au plus.
  let budget = CREATES_PER_TICK;
  for (const x of shots) {
    if (budget <= 0) break;
    if (!x.img && !x.it && !x.di) {
      if (x.itry >= 2 || x.cf >= 6) { x.di = 1; continue; }
      const id = await k.createImage(x.itry ? x.s : x.p, photos);
      budget--;
      if (id) { x.it = id; x.itry++; x.cf = 0; } else x.cf++;
      continue;
    }
    if (x.img && !x.vid && !x.vt && !x.dv) {
      if (x.vtry >= 2 || x.cf >= 6) { x.dv = 1; continue; }
      const id = await k.createVideo(x.m, x.img, x.dur > 7.5 ? '10' : '5');
      budget--;
      if (id) { x.vt = id; x.vtry++; x.cf = 0; } else x.cf++;
    }
  }

  const finished = shots.every(settled) || age > GIVE_UP;
  return { shots: shots, finished: finished };
}

/* Ce que la page du client joue. Un plan sans image prend celle du voisin le
 * plus proche : jamais un trou noir dans la video. */
export function playable(row) {
  const shots = row.shots || [];
  const pick = function (n) {
    for (let d = 0; d < shots.length; d++) {
      const a = shots[n - d], b = shots[n + d];
      if (a && a.img) return a;
      if (b && b.img) return b;
    }
    return null;
  };
  const beats = shots.map(function (x, n) {
    const src = x.img ? x : pick(n);
    return {
      at: x.at, dur: x.dur,
      clip: x.img ? (x.vid || '') : ((src && src.vid) || ''),
      poster: src ? src.img : '',
      drift: n % 2 ? 'out' : 'in'
    };
  });
  return {
    song: row.song_url || '',
    songStart: Number(row.song_start) || 0,
    duration: Number(row.song_duration) || 0,
    title: row.song_title || '',
    beats: beats
  };
}

export function anyImage(shots) {
  return (shots || []).some(function (x) { return !!x.img; });
}
