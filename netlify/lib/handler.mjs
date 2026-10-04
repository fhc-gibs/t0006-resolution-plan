// Request handler for the T0006 feedback form API. Kept separate from the function
// entry file so it can be tested without Netlify.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const clip = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const safeEq = (a, b) => {
  const x = Buffer.from(sha(a)), y = Buffer.from(sha(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export function makeHandler(getStore, env = {}) {
  const adminKey = env.ADMIN_KEY || '';
  const MAX_HISTORY = 100;

  return async function handler(req) {
    const store = getStore();
    const token = req.headers.get('x-client-token') || '';
    const given = req.headers.get('x-admin-key') || '';
    const isAdmin = !!adminKey && !!given && safeEq(given, adminKey);
    const ownerHash = token.length >= 16 ? sha(token) : '';

    async function logHistory(action, item, name, text) {
      const ts = new Date().toISOString();
      const key = `h/${ts}_${randomBytes(3).toString('hex')}`;
      await store.setJSON(key, { ts, action, item, name: name || '', snippet: clip(text, 120) });
    }
    const canTouch = (rec) => isAdmin || (!!ownerHash && rec.owner === ownerHash);

    if (req.method === 'GET') {
      const [rl, hl] = await Promise.all([store.list({ prefix: 'r/' }), store.list({ prefix: 'h/' })]);
      const rows = await Promise.all(rl.blobs.map((b) => store.get(b.key, { type: 'json', consistency: 'strong' })));
      const responses = rows.filter(Boolean).map((r) => ({
        id: r.id, item: r.item, name: r.name, text: r.text,
        createdAt: r.createdAt, updatedAt: r.updatedAt,
        mine: !!ownerHash && r.owner === ownerHash,
      }));
      const hkeys = hl.blobs.map((b) => b.key).sort().reverse();
      const history = (await Promise.all(
        hkeys.slice(0, MAX_HISTORY).map((k) => store.get(k, { type: 'json', consistency: 'strong' })),
      )).filter(Boolean);
      return json({ responses, history, admin: isAdmin, adminEnabled: !!adminKey });
    }

    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let body;
    try {
      const raw = await req.text();
      if (raw.length > 20000) return json({ error: 'too_large' }, 413);
      body = JSON.parse(raw);
    } catch { return json({ error: 'bad_json' }, 400); }

    const id = String(body.id || '');
    if (id && !/^[a-z0-9]{6,32}$/.test(id)) return json({ error: 'bad_id' }, 400);

    if (body.action === 'save') {
      const item = String(body.item || '');
      const name = String(body.name || '').trim().slice(0, 80);
      const text = String(body.text || '').trim().slice(0, 4000);
      if (!/^[A-E][0-9]{1,2}$/.test(item)) return json({ error: 'bad_item' }, 400);
      if (!name || !text) return json({ error: 'empty' }, 400);
      if (!ownerHash) return json({ error: 'no_token' }, 400);
      const now = new Date().toISOString();
      const existing = id ? await store.get(`r/${id}`, { type: 'json', consistency: 'strong' }) : null;
      let rec, action;
      if (existing) {
        if (!canTouch(existing)) return json({ error: 'forbidden' }, 403);
        rec = { ...existing, name, text, updatedAt: now };
        action = 'Edited';
      } else {
        rec = { id: id || randomBytes(6).toString('hex'), item, name, text, owner: ownerHash, createdAt: now, updatedAt: now };
        action = 'Saved';
      }
      await store.setJSON(`r/${rec.id}`, rec);
      await logHistory(action, rec.item, name, text);
      return json({ ok: true, record: { id: rec.id, item: rec.item, name, text, createdAt: rec.createdAt, updatedAt: rec.updatedAt, mine: true } });
    }

    if (body.action === 'delete') {
      if (!id) return json({ error: 'bad_id' }, 400);
      const existing = await store.get(`r/${id}`, { type: 'json', consistency: 'strong' });
      if (!existing) return json({ ok: true, already: true });
      if (!canTouch(existing)) return json({ error: 'forbidden' }, 403);
      await store.delete(`r/${id}`);
      await logHistory('Deleted', existing.item, existing.name, existing.text);
      return json({ ok: true });
    }

    return json({ error: 'bad_action' }, 400);
  };
}
