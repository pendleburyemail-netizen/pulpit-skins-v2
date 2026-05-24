// Visit /api/rawhtml?id=553229 — returns the raw SmartGolf HTML so we can inspect it directly
export default async function handler(req, res) {
  const session = process.env.SMARTGOLF_SESSION || '';
  const id      = req.query.id || 553229;
  const url     = `https://smartgolf.online/game_week_users/${id}/scores?detailed_view=1`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept':        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Cookie':        `_smart_golf_league_session=${session}`,
        'Sec-Fetch-Dest':'document','Sec-Fetch-Mode':'navigate',
        'Sec-Fetch-Site':'none','Upgrade-Insecure-Requests':'1',
      },
      redirect:'follow',
    });
    const html = await response.text();
    // Return raw HTML so we can view it in browser
    res.setHeader('Content-Type','text/html');
    res.setHeader('Access-Control-Allow-Origin','*');
    res.status(200).send(html);
  } catch(err) {
    res.status(502).send(`Error: ${err.message}`);
  }
}
