// Vercel Blob sync using REST API directly (no npm package needed)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const token   = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not set' });

  const FILENAME = 'pulpit-skins-activeweek.json';
  const BASE_URL = 'https://blob.vercel-storage.com';

  try {
    // GET — find and return current week data
    if (req.method === 'GET') {
      // List blobs to find our file
      const listRes = await fetch(`${BASE_URL}?prefix=pulpit-skins-activeweek`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) return res.status(200).json({ found: false });
      const list = await listRes.json();
      const blob = list.blobs?.find(b => b.pathname === FILENAME);
      if (!blob) return res.status(200).json({ found: false });

      const dataRes = await fetch(blob.url);
      if (!dataRes.ok) return res.status(200).json({ found: false });
      const data = await dataRes.json();
      return res.status(200).json({ found: true, data });
    }

    // POST — save week data
    if (req.method === 'POST') {
      let body = '';
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body) {
        body = JSON.stringify(req.body);
      } else {
        // Read raw body
        body = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
      }

      const putRes = await fetch(`${BASE_URL}/${FILENAME}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-api-version': '7',
          'x-add-random-suffix': '0',
          'x-cache-control-max-age': '0',
        },
        body,
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        console.error('Blob PUT error:', putRes.status, errText);
        return res.status(500).json({ error: `Blob PUT failed: ${putRes.status}` });
      }

      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('sync error:', e);
    res.status(500).json({ error: e.message });
  }
}
