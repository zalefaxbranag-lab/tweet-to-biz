/* KIE, exactement comme le worker enfants en production (v4.13) l'appelle :
 *
 *   depot     POST https://kieai.redpandaai.co/api/file-base64-upload
 *             { base64Data, uploadPath, fileName } -> downloadUrl | data.downloadUrl | data.url
 *   tache     POST https://api.kie.ai/api/v1/jobs/createTask  { model, input }
 *             -> data.taskId | data.recordId
 *   suivi     GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=
 *             successFlag 1 = fini (resultJson.resultUrls[0]), 2 ou 3 = echec
 *
 * Plus la chanson, qui a ses routes a elle :
 *
 *   POST https://api.kie.ai/api/v1/generate
 *   GET  https://api.kie.ai/api/v1/generate/record-info?taskId=
 *   POST https://api.kie.ai/api/v1/generate/get-timestamped-lyrics   (facultative)
 *
 * Aucune de ces fonctions ne leve d'exception : elles rendent une valeur vide
 * ou un etat « failed », et c'est l'appelant qui decide. Une erreur reseau sur
 * une image ne doit jamais faire tomber les six autres taches.
 */

export const API = 'https://api.kie.ai/api/v1';
export const UPLOAD = 'https://kieai.redpandaai.co/api/file-base64-upload';
export const IMAGE_MODEL = 'nano-banana-pro';
export const SONG_MODEL = 'V5';

// Les etats de la chanson qui ne reviendront jamais.
const SONG_DEAD = ['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION',
  'SENSITIVE_WORD_ERROR', 'GENERATE_LYRICS_FAILED'];

export function kie(env, fetchImpl) {
  const go = fetchImpl || fetch;
  const H = { 'Authorization': 'Bearer ' + env.KIE_KEY, 'Content-Type': 'application/json' };

  async function call(url, init) {
    try {
      const r = await go(url, init);
      let body = {};
      try { body = await r.json(); } catch (e) { body = {}; }
      // KIE repond parfois 200 avec un code d'erreur dans le corps (credits,
      // cle, cadence) : les deux doivent etre bons.
      const ok = r.ok && (body.code === undefined || body.code === 200);
      return { ok: ok, status: r.status, body: body };
    } catch (e) {
      return { ok: false, status: 0, body: {} };
    }
  }

  return {
    async upload(dataUrl, fileName) {
      const r = await call(UPLOAD, {
        method: 'POST', headers: H,
        body: JSON.stringify({ base64Data: dataUrl, uploadPath: 'craftstory/duo', fileName: fileName })
      });
      const b = r.body || {};
      return b.downloadUrl || (b.data && (b.data.downloadUrl || b.data.url)) || '';
    },

    async createImage(prompt, refs) {
      const r = await call(API + '/jobs/createTask', {
        method: 'POST', headers: H,
        body: JSON.stringify({
          model: IMAGE_MODEL,
          input: { prompt: prompt, image_input: refs, output_format: 'png', aspect_ratio: '16:9' }
        })
      });
      const d = (r.body && r.body.data) || {};
      return r.ok ? (d.taskId || d.recordId || '') : '';
    },

    async imageInfo(taskId) {
      if (!taskId) return { state: 'failed' };
      const r = await call(API + '/jobs/recordInfo?taskId=' + encodeURIComponent(taskId), { headers: H });
      const d = (r.body && r.body.data) || null;
      if (!d) return { state: 'running' };
      const st = String(d.state || '').toLowerCase();
      if (d.successFlag === 1 || st === 'success') {
        let url = '';
        try {
          const out = typeof d.resultJson === 'string' ? JSON.parse(d.resultJson) : (d.resultJson || {});
          url = (out.resultUrls || out.urls || [])[0] || '';
        } catch (e) { url = ''; }
        return url ? { state: 'done', url: url } : { state: 'failed' };
      }
      if (d.successFlag === 2 || d.successFlag === 3 || st === 'fail' || st === 'failed') {
        return { state: 'failed' };
      }
      return { state: 'running' };
    },

    async createSong(prompt, callBackUrl) {
      const r = await call(API + '/generate', {
        method: 'POST', headers: H,
        body: JSON.stringify({
          prompt: prompt,
          customMode: false,
          instrumental: false,
          model: SONG_MODEL,
          callBackUrl: callBackUrl
        })
      });
      const d = (r.body && r.body.data) || {};
      return r.ok ? (d.taskId || d.task_id || '') : '';
    },

    async songInfo(taskId) {
      if (!taskId) return { state: 'failed' };
      const r = await call(API + '/generate/record-info?taskId=' + encodeURIComponent(taskId), { headers: H });
      const d = (r.body && r.body.data) || null;
      if (!d) return { state: 'running' };
      const status = String(d.status || '').toUpperCase();
      const resp = d.response || {};
      const list = resp.sunoData || resp.data || d.sunoData || d.data || [];
      const tracks = Array.isArray(list) ? list : [];
      const full = tracks.find(function (t) { return t && (t.audioUrl || t.audio_url); });
      const live = tracks.find(function (t) { return t && (t.streamAudioUrl || t.stream_audio_url); });
      if (full) {
        return {
          state: 'done',
          url: full.audioUrl || full.audio_url,
          audioId: full.id || full.audioId || '',
          duration: Number(full.duration) || 0,
          title: full.title || '',
          lyrics: full.prompt || full.lyric || ''
        };
      }
      if (SONG_DEAD.indexOf(status) > -1 || /FAIL|ERROR/.test(status)) return { state: 'failed' };
      return {
        state: 'running',
        stream: live ? (live.streamAudioUrl || live.stream_audio_url) : '',
        audioId: live ? (live.id || '') : ''
      };
    },

    // Facultatif : sert seulement a faire demarrer la preview sur la voix
    // plutot que sur l'intro. Si la route ne repond pas, on demarre a zero.
    async songWords(taskId, audioId) {
      const r = await call(API + '/generate/get-timestamped-lyrics', {
        method: 'POST', headers: H,
        body: JSON.stringify({ taskId: taskId, audioId: audioId, musicIndex: 0 })
      });
      const d = (r.body && r.body.data) || {};
      const w = d.alignedWords || d.aligned_words || d.words;
      return Array.isArray(w) ? w : null;
    }
  };
}
