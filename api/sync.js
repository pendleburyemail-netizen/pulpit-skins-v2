// Sync using JSONBin.io — simple JSON storage, no SDK needed
const JSONBIN_URL = 'https://api.jsonbin.io/v3/b';
const BIN_NAME    = 'pulpit-skins-activeweek';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.JSONBIN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'JSONBIN_API_KEY not set' });

  try {
    // GET — find our bin and return its contents
    if (req.method === 'GET') {
      // Search for existing bin by name
      const searchRes = await fetch(`https://api.jsonbin.io/v3/b?binName=${BIN_NAME}`, {
        headers: {
          'X-Master-Key': apiKey,
          'X-Bin-Name':   BIN_NAME,
        },
      });

      // List all bins and find ours
      const listRes = await fetch('https://api.jsonbin.io/v3/b', {
        headers: { 'X-Master-Key': apiKey },
      });

      if (!listRes.ok) return res.status(200).json({ found: false });
      const bins = await listRes.json();
      const bin  = bins.find?.(b => b.snippetMeta?.name === BIN_NAME);
      if (!bin) return res.status(200).json({ found: false });

      const dataRes = await fetch(`${JSONBIN_URL}/${bin.id}/latest`, {
        headers: { 'X-Master-Key': apiKey },
      });
      if (!dataRes.ok) return res.status(200).json({ found: false });
      const json = await dataRes.json();
      return res.status(200).json({ found: true, data: json.record });
    }

    // POST — create or update our bin
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Try to find existing bin first
      const listRes = await fetch('https://api.jsonbin.io/v3/b', {
        headers: { 'X-Master-Key': apiKey },
      });

      let binId = null;
      if (listRes.ok) {
        const bins = await listRes.json();
        const bin  = bins.find?.(b => b.snippetMeta?.name === BIN_NAME);
        if (bin) binId = bin.id;
      }

      if (binId) {
        // Update existing bin
        const updateRes = await fetch(`${JSONBIN_URL}/${binId}`, {
          method:  'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': apiKey,
          },
          body: JSON.stringify(body),
        });
        if (!updateRes.ok) {
          const err = await updateRes.text();
          return res.status(500).json({ error: `Update failed: ${err}` });
        }
      } else {
        // Create new bin
        const createRes = await fetch(JSONBIN_URL, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': apiKey,
            'X-Bin-Name':   BIN_NAME,
            'X-Bin-Private': 'true',
          },
          body: JSON.stringify(body),
        });
        if (!createRes.ok) {
          const err = await createRes.text();
          return res.status(500).json({ error: `Create failed: ${err}` });
        }
      }

      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('sync error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
