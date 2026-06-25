import { put, list, del } from '@vercel/blob';

const PATHNAME = 'pulpit-skins-activeweek.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    // GET — return stored week data
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: 'pulpit-skins-activeweek' });
      const blob = blobs.find(b => b.pathname === PATHNAME);
      if (!blob) return res.status(200).json({ found: false });
      const r = await fetch(blob.url);
      if (!r.ok) return res.status(200).json({ found: false });
      const data = await r.json();
      return res.status(200).json({ found: true, data });
    }

    // POST — save week data (overwrite)
    if (req.method === 'POST') {
      // Delete existing first so we can overwrite (addRandomSuffix:false requires this)
      try {
        const { blobs } = await list({ prefix: 'pulpit-skins-activeweek' });
        if (blobs.length > 0) await del(blobs.map(b => b.url));
      } catch(e) { /* ignore if nothing to delete */ }

      const body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

      await put(PATHNAME, body, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });

      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('sync error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
}
