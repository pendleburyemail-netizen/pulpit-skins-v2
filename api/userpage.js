// Inspect SmartGolf user profile and league pages to find weekly score IDs
// /api/userpage?userId=30685
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const session = process.env.SMARTGOLF_SESSION || '';
  const userId  = req.query.userId || '30685';

  const headers = {
    'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Accept':        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-CA,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest':'document','Sec-Fetch-Mode':'navigate',
    'Sec-Fetch-Site':'none','Upgrade-Insecure-Requests':'1',
  };
  if (session) headers['Cookie'] = `_smart_golf_league_session=${session}`;

  const results = {};

  // Try 1: user profile page
  try {
    const r = await fetch(`https://smartgolf.online/users/${userId}`, { headers, redirect:'follow' });
    const html = await r.text();
    const gwuIds = [...html.matchAll(/game_week_users\/(\d+)/g)].map(m=>m[1]);
    results.profilePage = {
      status: r.status,
      gwuIdsFound: [...new Set(gwuIds)],
      htmlLength: html.length,
      snippet: html.slice(0,800),
    };
  } catch(e) { results.profilePage = {error: e.message}; }

  // Try 2: user scores page
  try {
    const r = await fetch(`https://smartgolf.online/users/${userId}/scores`, { headers, redirect:'follow' });
    const html = await r.text();
    const gwuIds = [...html.matchAll(/game_week_users\/(\d+)/g)].map(m=>m[1]);
    results.scoresPage = {
      status: r.status,
      gwuIdsFound: [...new Set(gwuIds)],
      htmlLength: html.length,
      snippet: html.slice(0,800),
    };
  } catch(e) { results.scoresPage = {error: e.message}; }

  // Try 3: weekly results page filtered by user
  try {
    const r = await fetch(`https://smartgolf.online/weekly_results/players?q=${userId}`, { headers, redirect:'follow' });
    const html = await r.text();
    const gwuIds = [...html.matchAll(/game_week_users\/(\d+)/g)].map(m=>m[1]);
    results.weeklyResults = {
      status: r.status,
      gwuIdsFound: [...new Set(gwuIds)],
      htmlLength: html.length,
      snippet: html.slice(0,800),
    };
  } catch(e) { results.weeklyResults = {error: e.message}; }

  // Try 4: league page (known to work)
  try {
    const r = await fetch(`https://smartgolf.online/l/80fafd`, { headers, redirect:'follow' });
    const html = await r.text();
    const gwuIds = [...html.matchAll(/game_week_users\/(\d+)/g)].map(m=>m[1]);
    results.leaguePage = {
      status: r.status,
      gwuIdsFound: [...new Set(gwuIds)].slice(0,10),
      htmlLength: html.length,
      snippet: html.slice(0,800),
    };
  } catch(e) { results.leaguePage = {error: e.message}; }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(results);
}
