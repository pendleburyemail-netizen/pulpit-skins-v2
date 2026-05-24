// Vercel serverless proxy — fetches SmartGolf score pages
// GET /api/scores?id=553245
// Requires SMARTGOLF_SESSION env var set in Vercel dashboard (once per season)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { id } = req.query;
  if (!id || !/^\d+$/.test(id)) {
    res.status(400).json({ error: 'Missing or invalid id' });
    return;
  }

  // Session cookie — stored as a Vercel environment variable
  const session = process.env.SMARTGOLF_SESSION;
  if (!session) {
    res.status(503).json({
      error: 'NO_SESSION',
      message: 'SMARTGOLF_SESSION environment variable not set in Vercel. See setup instructions.',
    });
    return;
  }

  const url = `https://smartgolf.online/game_week_users/${id}/scores?detailed_view=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language':           'en-CA,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding':           'gzip, deflate, br, zstd',
        'Cache-Control':             'no-cache',
        'Connection':                'keep-alive',
        'Cookie':                    `_smart_golf_league_session=${session}`,
        'Sec-Ch-Ua':                 '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
        'Sec-Ch-Ua-Mobile':          '?0',
        'Sec-Ch-Ua-Platform':        '"Windows"',
        'Sec-Fetch-Dest':            'document',
        'Sec-Fetch-Mode':            'navigate',
        'Sec-Fetch-Site':            'none',
        'Sec-Fetch-User':            '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    const html = await response.text();

    if (html.includes('user-scores-table')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(html);
    }

    // Didn't get a scorecard — return diagnostics
    res.status(200).json({
      error:      'NO_SCORECARD',
      httpStatus: response.status,
      finalUrl:   response.url,
      hasLogin:   html.includes('sign_in') && html.includes('Password'),
      sessionSet: !!session,
      snippet:    html.slice(0, 600),
    });

  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
