import { put, get, del } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const BLOB_KEY = 'pulpit-skins-activeweek.json';

  try {
    // GET — load shared week data
    if (req.method === 'GET') {
      try {
        const existing = await get(BLOB_KEY);
        if (!existing) return res.status(200).json({ found: false });
        const text = await existing.text();
        return res.status(200).json({ found: true, data: JSON.parse(text) });
      } catch (e) {
        return res.status(200).json({ found: false });
      }
    }

    // POST — save shared week data
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      await put(BLOB_KEY, body, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });
      return res.status(200).json({ ok: true });
    }

    // DELETE — clear shared week data
    if (req.method === 'DELETE') {
      try { await del(BLOB_KEY); } catch(e) {}
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('sync error:', e);
    res.status(500).json({ error: e.message });
  }
}
