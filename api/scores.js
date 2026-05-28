// Pulpit Club Skins — SmartGolf proxy
// Accepts permanent userId (e.g. 30685) and discovers the current week's
// game_week_user ID automatically from the user profile page.
// Falls back to direct game_week_user ID if provided.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { userId, gwuId, weekLabel } = req.query;

  if (!userId && !gwuId) {
    return res.status(400).json({ error: 'Provide userId (permanent) or gwuId (weekly)' });
  }

  const session = process.env.SMARTGOLF_SESSION || '';

  const headers = {
    'User-Agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Accept':         'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language':'en-CA,en;q=0.9',
    'Cache-Control':  'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
  };
  if (session) headers['Cookie'] = `_smart_golf_league_session=${session}`;

  try {
    let scoreUrl = null;

    if (gwuId) {
      // Direct game_week_user ID provided — use it
      scoreUrl = `https://smartgolf.online/game_week_users/${gwuId}/scores?detailed_view=1`;
    } else {
      // Step 1: fetch user profile page to find current week's game_week_user ID
      const profileUrl  = `https://smartgolf.online/users/${userId}`;
      const profileResp = await fetch(profileUrl, { headers, redirect:'follow' });
      const profileHtml = await profileResp.text();

      // Extract game_week_user IDs from the profile page
      // SmartGolf embeds them as links or turbo-frame src attributes like:
      // /game_week_users/568930/scores or game_week_users/568930
      const gwuMatches = [...profileHtml.matchAll(/game_week_users\/(\d+)/g)];
      const gwuIds     = [...new Set(gwuMatches.map(m => m[1]))];

      if (!gwuIds.length) {
        // Profile loaded but no game_week_user IDs found — likely JS-rendered
        return res.status(200).json({
          error:       'NO_GWU_ID',
          message:     'Profile page loaded but no game_week_user ID found. Page may be JS-rendered.',
          profileSnip: profileHtml.slice(0, 1000),
        });
      }

      // If weekLabel provided (e.g. "Week 2"), try to find matching round
      // Otherwise use the most recent ID (highest number = most recent)
      let chosenId = null;
      if (weekLabel) {
        // Look for week label near each ID in the HTML
        gwuIds.forEach(id => {
          const idPos  = profileHtml.indexOf(id);
          const nearby = profileHtml.slice(Math.max(0, idPos-200), idPos+200);
          if (nearby.toLowerCase().includes(weekLabel.toLowerCase())) {
            chosenId = id;
          }
        });
      }
      // Fall back to highest ID (most recent round)
      if (!chosenId) {
        chosenId = gwuIds.reduce((max, id) => parseInt(id) > parseInt(max) ? id : max, gwuIds[0]);
      }

      scoreUrl = `https://smartgolf.online/game_week_users/${chosenId}/scores?detailed_view=1`;
    }

    // Step 2: fetch the score page
    const scoreResp = await fetch(scoreUrl, { headers, redirect:'follow' });
    const scoreHtml = await scoreResp.text();

    if (!scoreHtml.includes('user-scores-table')) {
      return res.status(200).json({
        error:      'NO_SCORECARD',
        httpStatus: scoreResp.status,
        scoreUrl,
        hasLogin:   scoreHtml.includes('sign_in') && scoreHtml.includes('Password'),
        snippet:    scoreHtml.slice(0, 500),
      });
    }

    // Return score HTML with the discovered GWU ID as a header for reference
    const gwuIdUsed = scoreUrl.match(/game_week_users\/(\d+)/)?.[1] || '';
    res.setHeader('Content-Type',   'text/html; charset=utf-8');
    res.setHeader('Cache-Control',  'no-store');
    res.setHeader('X-GWU-ID',       gwuIdUsed);
    res.status(200).send(scoreHtml);

  } catch(err) {
    res.status(502).json({ error: err.message });
  }
}
