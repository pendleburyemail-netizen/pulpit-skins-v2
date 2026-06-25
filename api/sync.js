import { put, list, del } from '@vercel/blob';

const PATHNAME = 'pulpit-skins-activeweek.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: 'pulpit-skins-activeweek' });
      if (!blobs.length) return res.status(200).json({ found: false });
      // fetch the public blob URL directly
      const r = await fetch(blobs[0].url);
      if (!r.ok) return res.status(200).json({ found: false });
      const data = await r.json();
      return res.status(200).json({ found: true, data });
    }

    if (req.method === 'POST') {
      // Read body
      const body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

      // Delete any existing blob first
      const { blobs } = await list({ prefix: 'pulpit-skins-activeweek' });
      if (blobs.length) {
        await del(blobs.map(b => b.url));
      }

      // Upload new blob
      const result = await put(PATHNAME, body, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });

      console.log('Blob stored at:', result.url);
      return res.status(200).json({ ok: true, url: result.url });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
