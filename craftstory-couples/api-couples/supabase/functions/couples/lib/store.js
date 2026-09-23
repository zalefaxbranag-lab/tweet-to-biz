/* La base et le stockage du projet, par leurs routes HTTP (PostgREST et
 * Storage), avec la cle du role service que Supabase donne a la fonction.
 *
 * Rien ici ne leve d'exception : une lecture ratee rend null ou '', une
 * ecriture ratee rend false, et c'est l'appelant qui decide.
 *
 * Les secrets (cle KIE, cle du minuteur) vivent dans le coffre Supabase ; seule
 * la fonction SQL couples_secret() les lit, et seul le role service peut
 * l'appeler.
 */

export function store(env, fetchImpl) {
  const go = fetchImpl || fetch;
  const base = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.SERVICE_KEY || '';
  const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

  async function call(path, init) {
    try {
      const i = Object.assign({}, init || {});
      i.headers = Object.assign({}, H, i.headers || {});
      const r = await go(base + path, i);
      const txt = await r.text();
      let body = null;
      try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = txt; }
      return { ok: r.ok, status: r.status, body: body };
    } catch (e) {
      return { ok: false, status: 0, body: null };
    }
  }

  const T = '/rest/v1/couples_orders';
  const one = function (v) { return '?view_key=eq.' + encodeURIComponent(v); };

  return {
    async secret(name) {
      const r = await call('/rest/v1/rpc/couples_secret', { method: 'POST', body: JSON.stringify({ p_name: name }) });
      return r.ok && typeof r.body === 'string' ? r.body : '';
    },

    async get(view) {
      const r = await call(T + one(view) + '&select=*');
      return r.ok && Array.isArray(r.body) ? (r.body[0] || null) : null;
    },

    // Une fois par dossier : un second clic sur « payer » retombe sur la meme ligne.
    async create(row) {
      const r = await call(T + '?on_conflict=view_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(row)
      });
      return r.ok;
    },

    // Le verrou : deux passages du minuteur ne travaillent jamais sur la meme
    // commande en meme temps (sinon chaque image serait commandee deux fois).
    async claim(view, seconds) {
      const now = new Date();
      const until = new Date(now.getTime() + seconds * 1000).toISOString();
      const free = encodeURIComponent('(lease_until.is.null,lease_until.lt.' + now.toISOString() + ')');
      const r = await call(T + one(view) + '&or=' + free, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ lease_until: until })
      });
      return r.ok && Array.isArray(r.body) ? (r.body[0] || null) : null;
    },

    async save(view, patch) {
      const body = Object.assign({}, patch, { updated_at: new Date().toISOString(), lease_until: null });
      const r = await call(T + one(view), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
      return r.ok;
    },

    async active(limit) {
      const r = await call(T + '?select=view_key&state=in.(paid,making)&order=paid_at.asc&limit=' + (limit || 4));
      return r.ok && Array.isArray(r.body) ? r.body.map(function (x) { return x.view_key; }) : [];
    },

    async put(path, bytes, type) {
      const r = await call('/storage/v1/object/couples/' + path, {
        method: 'POST',
        headers: { 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'true' },
        body: bytes
      });
      return r.ok;
    },

    async sign(path, seconds) {
      const r = await call('/storage/v1/object/sign/couples/' + path, {
        method: 'POST', body: JSON.stringify({ expiresIn: seconds })
      });
      const u = r.ok && r.body && (r.body.signedURL || r.body.signedUrl);
      return u ? base + '/storage/v1' + (u.charAt(0) === '/' ? '' : '/') + u : '';
    },

    // Copie un fichier distant (photo, chanson) dans le stockage du projet :
    // les liens KIE expirent, les notres non.
    async keep(url, path, type) {
      try {
        const r = await go(url);
        if (!r.ok) return false;
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (!bytes.length || bytes.length > 25000000) return false;
        return await this.put(path, bytes, type || r.headers.get('content-type') || 'application/octet-stream');
      } catch (e) {
        return false;
      }
    }
  };
}
