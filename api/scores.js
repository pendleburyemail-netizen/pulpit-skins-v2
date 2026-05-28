// Pulpit Club Skins proxy
// Accepts userId (permanent) + targetDate (YYYY-MM-DD) to find correct week's scores
// OR gwuId for direct access

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { userId, gwuId, targetDate } = req.query;
  if (!userId && !gwuId) return res.status(400).json({ error: 'Provide userId or gwuId' });

  const session = process.env.SMARTGOLF_SESSION || '';
  const headers = {
    'User-Agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Accept':         'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language':'en-CA,en;q=0.9',
    'Cache-Control':  'no-cache',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',     'Upgrade-Insecure-Requests': '1',
  };
  if (session) headers['Cookie'] = `_smart_golf_league_session=${session}`;

  const fetchHtml = async (url) => {
    const r = await fetch(url, { headers, redirect: 'follow' });
    return { html: await r.text(), status: r.status };
  };

  try {
    // ── Direct GWU ID ──────────────────────────────────────────────────────
    if (gwuId) {
      const { html } = await fetchHtml(
        `https://smartgolf.online/game_week_users/${gwuId}/scores?detailed_view=1`
      );
      if (!html.includes('user-scores-table'))
        return res.status(200).json({ error:'NO_SCORECARD', gwuId });
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.setHeader('X-GWU-ID', gwuId);
      res.setHeader('Cache-Control','no-store');
      return res.status(200).send(html);
    }

    // ── Permanent userId — need to find the right weekly GWU ID ───────────
    // Strategy: scan the league page and user-specific pages for GWU IDs,
    // then fetch each score page and check its date until we find a match.

    // Collect candidate GWU IDs from multiple sources
    const candidateIds = new Set();

    // Source 1: user profile page (may be JS-rendered but worth trying)
    try {
      const { html } = await fetchHtml(`https://smartgolf.online/users/${userId}`);
      [...html.matchAll(/game_week_users\/(\d+)/g)].forEach(m => candidateIds.add(m[1]));
    } catch(e) {}

    // Source 2: league page (known to contain GWU IDs)
    try {
      const { html } = await fetchHtml(`https://smartgolf.online/l/80fafd`);
      [...html.matchAll(/game_week_users\/(\d+)/g)].forEach(m => candidateIds.add(m[1]));
    } catch(e) {}

    // Source 3: user scores sub-page
    try {
      const { html } = await fetchHtml(`https://smartgolf.online/users/${userId}/scores`);
      [...html.matchAll(/game_week_users\/(\d+)/g)].forEach(m => candidateIds.add(m[1]));
    } catch(e) {}

    const allIds = [...candidateIds].sort((a,b) => parseInt(b)-parseInt(a)); // newest first

    if (!allIds.length) {
      return res.status(200).json({
        error:   'NO_GWU_IDS',
        message: 'Could not find any game_week_user IDs. Profile page may be fully JS-rendered.',
        userId,
      });
    }

    // If no target date, just use highest ID (most recent)
    if (!targetDate) {
      const gwu = allIds[0];
      const { html } = await fetchHtml(
        `https://smartgolf.online/game_week_users/${gwu}/scores?detailed_view=1`
      );
      if (!html.includes('user-scores-table'))
        return res.status(200).json({ error:'NO_SCORECARD', gwuId:gwu });
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.setHeader('X-GWU-ID', gwu);
      res.setHeader('Cache-Control','no-store');
      return res.status(200).send(html);
    }

    // Target date provided — check each candidate score page for matching date
    // Date formats SmartGolf might use: "May 27, 2026", "2026-05-27", "27/05/2026"
    const d      = new Date(targetDate);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const datePatterns = [
      targetDate,                                          // 2026-05-27
      `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`,   // 27 May 2026
      `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,  // May 27, 2026
      `${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, // 27/05/2026
    ];

    for (const gwu of allIds) {
      try {
        const { html } = await fetchHtml(
          `https://smartgolf.online/game_week_users/${gwu}/scores?detailed_view=1`
        );
        if (!html.includes('user-scores-table')) continue;
        const matchesDate = datePatterns.some(pat => html.includes(pat));
        if (matchesDate) {
          res.setHeader('Content-Type','text/html; charset=utf-8');
          res.setHeader('X-GWU-ID', gwu);
          res.setHeader('Cache-Control','no-store');
          return res.status(200).send(html);
        }
      } catch(e) { continue; }
    }

    // No date match found — return the most recent and flag it
    const gwu = allIds[0];
    const { html } = await fetchHtml(
      `https://smartgolf.online/game_week_users/${gwu}/scores?detailed_view=1`
    );
    if (!html.includes('user-scores-table'))
      return res.status(200).json({ error:'NO_SCORECARD', gwuId:gwu });
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('X-GWU-ID', gwu);
    res.setHeader('X-Date-Match','false'); // tells frontend no date match found
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(html);

  } catch(err) {
    res.status(502).json({ error: err.message });
  }
}
