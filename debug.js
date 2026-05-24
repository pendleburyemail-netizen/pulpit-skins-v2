// Diagnostic endpoint — visit /api/debug in browser to test the proxy
// Remove this file once working

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const session = process.env.SMARTGOLF_SESSION || '';
  const testId  = 553229; // Brett Bandula
  const url     = `https://smartgolf.online/game_week_users/${testId}/scores?detailed_view=1`;

  const sentHeaders = {
    'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language':           'en-CA,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control':             'no-cache',
    'Cookie':                    `_smart_golf_league_session=${session}`,
    'Sec-Ch-Ua':                 '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'Sec-Ch-Ua-Mobile':          '?0',
    'Sec-Ch-Ua-Platform':        '"Windows"',
    'Sec-Fetch-Dest':            'document',
    'Sec-Fetch-Mode':            'navigate',
    'Sec-Fetch-Site':            'none',
    'Sec-Fetch-User':            '?1',
    'Upgrade-Insecure-Requests': '1',
  };

  let result = {};

  try {
    const response = await fetch(url, { headers: sentHeaders, redirect: 'follow' });
    const html     = await response.text();

    result = {
      // Environment
      sessionEnvSet:    !!session,
      sessionLength:    session.length,
      sessionPreview:   session.slice(0, 40) + '...',

      // What we sent
      cookieHeaderSent: `_smart_golf_league_session=${session.slice(0,30)}...`,

      // What SmartGolf returned
      httpStatus:       response.status,
      finalUrl:         response.url,
      contentType:      response.headers.get('content-type'),

      // Page analysis
      hasScoreTable:    html.includes('user-scores-table'),
      hasLoginPage:     html.includes('sign_in') && html.includes('Password'),
      hasLeaguePage:    html.includes('game_week_user'),
      htmlLength:       html.length,
      htmlSnippet:      html.slice(0, 800),
    };
  } catch(err) {
    result = { fetchError: err.message, sessionEnvSet: !!session, sessionLength: session.length };
  }

  res.status(200).json(result);
}
