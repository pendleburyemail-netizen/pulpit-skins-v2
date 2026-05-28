// Scan the league page and all linked round pages for game_week_user IDs
// GET /api/leaguescan
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const session = process.env.SMARTGOLF_SESSION || '';
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

  // Known URLs to scan
  const urls = [
    'https://smartgolf.online/l/80fafd',
    'https://smartgolf.online/access/2026-men-s-league-d4e520',
    'https://smartgolf.online/weekly_results',
    'https://smartgolf.online/weekly_results/players?game_week_id=8145',
  ];

  for (const url of urls) {
    try {
      const r    = await fetch(url, { headers, redirect:'follow' });
      const html = await r.text();
      // Find all game_week_user IDs
      const gwuIds   = [...new Set([...html.matchAll(/game_week_users\/(\d+)/g)].map(m=>m[1]))];
      // Find all game_week IDs  
      const gwIds    = [...new Set([...html.matchAll(/game_week(?:_id)?[=\/](\d+)/g)].map(m=>m[1]))];
      // Find all /access/ links
      const accLinks = [...new Set([...html.matchAll(/\/access\/([^"'\s]+)/g)].map(m=>m[1]))];
      // Find week labels near GWU IDs
      const weekRefs = [...html.matchAll(/[Ww]eek\s*\d+[^<]{0,50}/g)].map(m=>m[0].trim()).slice(0,10);
      // Date references
      const dateRefs = [...html.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+202[0-9]/g)].map(m=>m[0]).slice(0,10);

      results[url] = {
        status: r.status,
        finalUrl: r.url,
        htmlLength: html.length,
        gwuIds: gwuIds.slice(0,20),
        gwIds:  gwIds.slice(0,10),
        accLinks: accLinks.slice(0,10),
        weekRefs,
        dateRefs,
        snippet: html.slice(0,500),
      };
    } catch(e) {
      results[url] = { error: e.message };
    }
  }

  res.setHeader('Content-Type','application/json');
  res.status(200).json(results);
}
