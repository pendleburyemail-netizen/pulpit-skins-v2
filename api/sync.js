const JSONBIN_URL = 'https://api.jsonbin.io/v3/b';

function fetchWithTimeout(url, options = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.JSONBIN_API_KEY;
  const binId  = process.env.JSONBIN_BIN_ID;
  if (!apiKey) return res.status(500).json({ error: 'JSONBIN_API_KEY not set' });

  try {
    if (req.method === 'GET') {
      if (!binId) return res.status(200).json({ found: false, reason: 'no bin ID yet' });
      const r = await fetchWithTimeout(`${JSONBIN_URL}/${binId}/latest`, {
        headers: { 'X-Master-Key': apiKey },
      });
      if (!r.ok) return res.status(200).json({ found: false });
      const json = await r.json();
      return res.status(200).json({ found: true, data: json.record });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      if (binId) {
        const r = await fetchWithTimeout(`${JSONBIN_URL}/${binId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': apiKey,
            'X-Bin-Versioning': 'false',
          },
          body,
        });
        if (!r.ok) {
          const err = await r.text();
          return res.status(500).json({ error: `Update failed: ${err}` });
        }
        return res.status(200).json({ ok: true, binId });
      } else {
        const r = await fetchWithTimeout(JSONBIN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': apiKey,
            'X-Bin-Name':   'pulpit-skins-activeweek',
            'X-Bin-Private': 'true',
          },
          body,
        });
        if (!r.ok) {
          const err = await r.text();
          return res.status(500).json({ error: `Create failed: ${err}` });
        }
        const json = await r.json();
        const newBinId = json.metadata?.id;
        return res.status(200).json({
          ok: true,
          binId: newBinId,
          action: 'CREATED',
          message: `Bin created. Add JSONBIN_BIN_ID=${newBinId} as a Vercel env var then redeploy.`,
        });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Request timed out — try again' : e.message;
    console.error('sync error:', msg);
    res.status(500).json({ error: msg });
  }
}
