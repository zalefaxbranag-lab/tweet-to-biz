/* CraftStory — la fabrication des trente secondes.
 *
 * Un POST du tunnel entre ici, une table de montage en sort :
 *
 *   { song, seconds, beats: [ { at, dur, clip, poster, line, drift } ] }
 *
 * C'est EXACTEMENT ce que le lecteur de la page attend, plan par plan. Aucune
 * traduction entre les deux : ce qui est ecrit ici est ce qui est joue.
 *
 * L'ORDRE COMPTE, et c'est tout le sujet :
 *
 *   1. le scenario                      (0 s, aucun appel)
 *   2. la chanson ET les six images     (en parallele — elles ne dependent
 *                                        que de la photo, pas du son)
 *   3. les horodatages de la chanson    -> les coupes REELLES
 *   4. les six clips, aux durees des coupes
 *
 * On ne decide pas que chaque plan dure cinq secondes : on demande a la
 * chanson a quel instant chaque ligne est chantee, et on coupe la. C'est la
 * seule facon d'avoir un montage qui tombe sur la musique au lieu d'un
 * diaporama a cote.
 *
 * Ce qui est pre-genere, une fois pour toutes : les DECORS (un jeu par
 * occasion, un couple quelconque dedans). Jamais la chanson, jamais les
 * paroles, jamais le texte a l'ecran — ca vient de leurs reponses.
 *
 * Le nom des variables d'environnement seulement, jamais une valeur :
 *   KIE_KEY, SHOPIFY_ADMIN_TOKEN, SHOP, SCENE_BASE
 */
import { storyboard, alignBeats } from './couples-storyboard.js';

const KIE = 'https://api.kie.ai';

/* Les routes. Celles marquees (a confirmer) n'ont PAS pu etre verifiees depuis
 * l'environnement de developpement : api.kie.ai et docs.kie.ai y sont refuses
 * par la politique de sortie. Elles viennent de la documentation lue
 * precedemment. Le code ne suppose jamais qu'elles repondent : chaque appel a
 * un repli, et l'alignement retombe sur un decoupage regulier.
 */
const R = {
  song: '/api/v1/generate',
  songInfo: '/api/v1/generate/record-info',
  lyricsTimed: '/api/v1/generate/get-timestamped-lyrics',   // (a confirmer)
  task: '/jobs/createTask',
  taskInfo: '/jobs/recordInfo',
  upload: 'https://kieai.redpandaai.co/api/file-base64-upload'
};

const IMG_MODEL = 'nano-banana-pro';
const VID_MODEL = 'kling/v2.6-image-to-video';   // (a confirmer)

function auth(env) {
  return { Authorization: 'Bearer ' + env.KIE_KEY, 'Content-Type': 'application/json' };
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function post(url, headers, body) {
  const r = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return j;
}

/* La photo, telle que le tunnel l'envoie : un dataURL. On la depose une fois
 * et on reutilise l'URL pour les six images. La deposer six fois serait six
 * fois le meme transfert.
 */
async function hostPhoto(env, dataUrl, name) {
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) return '';
  const j = await post(R.upload, auth(env), {
    base64Data: dataUrl,
    uploadPath: 'craftstory/duo',
    fileName: name
  });
  return (j.data && (j.data.downloadUrl || j.data.fileUrl)) || '';
}

/* Un travail KIE, du depot au resultat.
 *
 * Le meme schema que le tunnel enfants : on cree la tache, on interroge toutes
 * les deux secondes, et on abandonne au bout du compte de tours plutot que de
 * tenir une requete ouverte indefiniment.
 */
async function run(env, model, input, polls) {
  const made = await post(KIE + R.task, auth(env), { model: model, input: input });
  const id = made.data && made.data.taskId;
  if (!id) throw new Error('pas de taskId pour ' + model);
  for (let n = 0; n < (polls || 60); n++) {
    await sleep(2000);
    const r = await fetch(KIE + R.taskInfo + '?taskId=' + encodeURIComponent(id),
      { headers: auth(env) });
    const j = await r.json().catch(function () { return {}; });
    const d = j.data || {};
    const state = String(d.state || d.status || '').toLowerCase();
    if (state === 'success' || state === 'succeeded') {
      let out = d.resultJson || d.result || d.output;
      if (typeof out === 'string') { try { out = JSON.parse(out); } catch (e) { /* tel quel */ } }
      const urls = (out && (out.resultUrls || out.urls || out.result_urls)) || [];
      if (urls.length) return urls[0];
      throw new Error(model + ' a reussi sans rendre de fichier');
    }
    if (state === 'fail' || state === 'failed' || state === 'error') {
      throw new Error(model + ' a echoue: ' + (d.failMsg || d.error || 'sans message'));
    }
  }
  throw new Error(model + ' n a pas repondu a temps');
}

/* UNE IMAGE PAR PLAN.
 *
 * `image_input` porte le DECOR d'abord, leurs photos ensuite : le decor donne
 * le cadre, la lumiere et la composition, leurs photos donnent les visages. Le
 * texte, lui, ne decrit QUE le decor.
 *
 * On ne decrit jamais leurs visages. Ce n'est pas une precaution de style :
 * un prompt qui decrit un visage se bat contre la photo, et c'est la photo qui
 * perd. C'est la lecon du tunnel enfants, payee une fois.
 */
function imagePrompt(beat) {
  return 'Use the two people from the reference photographs as the couple in '
    + 'this scene, keeping their faces exactly as they are. Scene: ' + beat.scene
    + '. Cinematic still, natural light, film grain, no text, no logo, no watermark.';
}

async function stills(env, sb, photos, scenes) {
  return Promise.all(sb.beats.map(function (b) {
    const refs = [scenes[b.template] || scenes.default].concat(photos).filter(Boolean);
    return run(env, IMG_MODEL, {
      prompt: imagePrompt(b),
      image_input: refs,
      output_format: 'png',
      image_size: '16:9'
    }, 60).catch(function (e) { return { error: String(e.message || e) }; });
  }));
}

/* UN CLIP PAR PLAN, A LA DUREE DE SA COUPE.
 *
 * Le modele ne rend que cinq ou dix secondes : on demande la borne qui couvre
 * la coupe, et le lecteur rogne le reste. Demander cinq quand la coupe en
 * demande sept laisserait deux secondes d'image figee — c'est exactement ce
 * qu'on ne veut pas.
 */
async function clips(env, beats, posters) {
  return Promise.all(beats.map(function (b, n) {
    const first = posters[n];
    if (!first || first.error) return Promise.resolve({ error: 'pas de premiere image' });
    return run(env, VID_MODEL, {
      prompt: b.motion + '. The couple stays exactly as in the source image. '
        + 'No text, no logo, no watermark.',
      image_url: first,
      duration: b.dur > 5 ? 10 : 5,
      aspect_ratio: '16:9'
    }, 90).catch(function (e) { return { error: String(e.message || e) }; });
  }));
}

/* LA CHANSON, ET SES HORODATAGES.
 *
 * Suno facture a la GENERATION, pas a la seconde : une generation rend un
 * morceau entier — deux, meme — pour le prix d'une. Il n'y a donc rien a
 * economiser en demandant trente secondes, et le morceau complet est deja la
 * le jour ou ils achetent. La preview s'arrete a trente secondes cote lecteur.
 */
async function song(env, sb) {
  const made = await post(KIE + R.song, auth(env), {
    customMode: true,
    instrumental: false,
    model: 'V5',
    title: sb.title,
    style: sb.style,
    prompt: sb.lyrics
  });
  const id = made.data && (made.data.taskId || made.data.task_id);
  if (!id) throw new Error('pas de taskId pour la chanson');

  for (let n = 0; n < 90; n++) {
    await sleep(2000);
    const r = await fetch(KIE + R.songInfo + '?taskId=' + encodeURIComponent(id),
      { headers: auth(env) });
    const j = await r.json().catch(function () { return {}; });
    const d = j.data || {};
    const list = (d.response && (d.response.sunoData || d.response.data)) || d.sunoData || [];
    const track = list.find(function (t) { return t && (t.audioUrl || t.audio_url); });
    if (track) {
      return {
        taskId: id,
        audioId: track.id || track.audioId,
        url: track.audioUrl || track.audio_url,
        // Le second morceau est rendu par la meme generation : c'est la
        // variante de secours, gratuite, si le premier deplait.
        spare: (list[1] && (list[1].audioUrl || list[1].audio_url)) || ''
      };
    }
    const state = String(d.status || d.state || '').toLowerCase();
    if (state.indexOf('fail') > -1 || state.indexOf('error') > -1) {
      throw new Error('la chanson a echoue: ' + (d.errorMessage || 'sans message'));
    }
  }
  throw new Error('la chanson n a pas repondu a temps');
}

/* Les mots horodates. C'est ce qui pose les coupes.
 *
 * Route a confirmer, donc le seul appel du systeme dont l'echec est NORMAL :
 * sans horodatage, alignBeats retombe sur un decoupage regulier et la preview
 * existe quand meme. On note juste honnetement qu'elle n'est pas calee.
 */
async function timings(env, track) {
  try {
    const j = await post(KIE + R.lyricsTimed, auth(env), {
      taskId: track.taskId, audioId: track.audioId, musicIndex: 0
    });
    const d = j.data || {};
    return d.alignedWords || d.aligned_words || d.words || null;
  } catch (e) {
    return null;
  }
}

/* LA FABRICATION.
 *
 * `scenes` est la table des decors pre-generes : { 'craftstory-duo-wedding':
 * 'https://…', …, default: 'https://…' }. Ils sont faits une fois, a la main,
 * et reutilises par tout le monde.
 */
async function makePreview(env, payload, scenes) {
  const sb = storyboard(payload);
  const seconds = Number(payload.seconds) || 30;

  // Les photos d'abord : les six images en dependent, la chanson non. Donc la
  // chanson part TOUT DE SUITE, en parallele du depot.
  const songJob = song(env, sb);

  const up = [];
  if (payload.photo) up.push(hostPhoto(env, payload.photo, 'duo-a.jpg'));
  if (payload.photo2) up.push(hostPhoto(env, payload.photo2, 'duo-b.jpg'));
  const photos = (await Promise.all(up.map(function (p) {
    return p.catch(function () { return ''; });
  }))).filter(Boolean);
  if (!photos.length) throw new Error('aucune photo utilisable');

  // Les six images partent maintenant, toujours en parallele de la chanson.
  const stillJob = stills(env, sb, photos, scenes || {});

  const [track, posters] = await Promise.all([songJob, stillJob]);

  // La chanson est la : on lui demande ou tombent ses lignes.
  const words = await timings(env, track);
  const cutBeats = alignBeats(sb.beats, words, seconds);

  // Et seulement maintenant les clips, parce que leur duree vient des coupes.
  const movies = await clips(env, cutBeats, posters);

  const beats = cutBeats.map(function (b, n) {
    const clip = movies[n];
    return {
      at: b.at,
      dur: b.dur,
      line: b.line,
      drift: b.drift,
      // Sans clip, le plan garde son image : un plan manquant ne doit pas
      // faire un trou noir de cinq secondes au milieu du montage.
      clip: (clip && !clip.error) ? clip : '',
      poster: (posters[n] && !posters[n].error) ? posters[n] : ''
    };
  }).filter(function (b) { return b.clip || b.poster; });

  return {
    song: track.url,
    songSpare: track.spare,
    seconds: seconds,
    aligned: cutBeats.every(function (b) { return b.aligned; }),
    lyrics: sb.lyrics,
    title: sb.title,
    beats: beats
  };
}

export { makePreview, storyboard, alignBeats, imagePrompt, R, IMG_MODEL, VID_MODEL };
