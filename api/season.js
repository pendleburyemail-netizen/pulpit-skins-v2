// Season/Sandbagger record — separate JSONBin from weekly scores
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
  const binId  = process.env.JSONBIN_SEASON_BIN_ID;
  const pin    = process.env.SKINS_SEASON_PIN || '1234';

  if (!apiKey) return res.status(500).json({ error: 'JSONBIN_API_KEY not set' });

  try {
    // GET — return season data (no PIN required to read)
    if (req.method === 'GET') {
      if (!binId) return res.status(200).json({ found: false, reason: 'no bin ID yet' });
      const r = await fetchWithTimeout(`${JSONBIN_URL}/${binId}/latest`, {
        headers: { 'X-Master-Key': apiKey },
      });
      if (!r.ok) return res.status(200).json({ found: false });
      const json = await r.json();
      return res.status(200).json({ found: true, data: json.record });
    }

    // POST — write season data (PIN required)
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Validate PIN
      if (!body.pin || String(body.pin) !== String(pin)) {
        return res.status(403).json({ error: 'Invalid PIN' });
      }

      const payload = JSON.stringify(body.season);

      if (binId) {
        const r = await fetchWithTimeout(`${JSONBIN_URL}/${binId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': apiKey,
            'X-Bin-Versioning': 'false',
          },
          body: payload,
        });
        if (!r.ok) {
          const err = await r.text();
          return res.status(500).json({ error: `Update failed: ${err}` });
        }
        return res.status(200).json({ ok: true });
      } else {
        // Create new season bin
        const r = await fetchWithTimeout(JSONBIN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': apiKey,
            'X-Bin-Name':   'pulpit-skins-season',
            'X-Bin-Private': 'true',
          },
          body: payload,
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
          message: `Season bin created. Add JSONBIN_SEASON_BIN_ID=${newBinId} as Vercel env var then redeploy.`,
        });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Request timed out — try again' : e.message;
    console.error('season sync error:', msg);
    res.status(500).json({ error: msg });
  }
}
