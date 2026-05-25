export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { id, gameWeekId, playerName } = req.query;
  if (!id || !/^\d+$/.test(id)) {
    res.status(400).json({ error: 'Missing or invalid id' });
    return;
  }

  const session = process.env.SMARTGOLF_SESSION;
  if (!session) {
    res.status(503).json({ error: 'NO_SESSION' });
    return;
  }

  const headers = {
    'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Accept':        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-CA,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Cookie':        `_smart_golf_league_session=${session}`,
    'Sec-Fetch-Dest':'document','Sec-Fetch-Mode':'navigate',
    'Sec-Fetch-Site':'none','Upgrade-Insecure-Requests':'1',
  };

  try {
    // ── Fetch 1: scores page (hole by hole gross/net) ──────────────────────
    const scoresUrl  = `https://smartgolf.online/game_week_users/${id}/scores?detailed_view=1`;
    const scoresResp = await fetch(scoresUrl, { headers, redirect:'follow' });
    const scoresHtml = await scoresResp.text();

    if (!scoresHtml.includes('user-scores-table')) {
      return res.status(200).json({
        error: 'NO_SCORECARD',
        httpStatus: scoresResp.status,
        hasLogin: scoresHtml.includes('sign_in') && scoresHtml.includes('Password'),
      });
    }

    // ── Fetch 2: weekly results page (HCP index + course HCP) ─────────────
    let hcpHtml = '';
    if (gameWeekId && playerName) {
      const lastName   = encodeURIComponent(playerName.split(' ').pop());
      const hcpUrl     = `https://smartgolf.online/weekly_results/players?game_week_id=${gameWeekId}&q=${lastName}&sort=total_gross_score&order=asc`;
      const hcpResp    = await fetch(hcpUrl, { headers, redirect:'follow' });
      hcpHtml          = await hcpResp.text();
    }

    // Return both HTML chunks combined with a separator
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(scoresHtml + '\n<!--HCP_DATA-->\n' + hcpHtml);

  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
