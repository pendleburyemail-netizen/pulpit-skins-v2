// Fetch weekly results page to inspect HCP data structure
// Visit /api/hcpdata?gameWeekId=8145&name=Pendlebury
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const session    = process.env.SMARTGOLF_SESSION || '';
  const gameWeekId = req.query.gameWeekId || '8145';
  const name       = req.query.name       || 'Pendlebury';
  const url = `https://smartgolf.online/weekly_results/players?game_week_id=${gameWeekId}&q=${encodeURIComponent(name)}&sort=total_gross_score&order=asc`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept':        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Cookie':        `_smart_golf_league_session=${session}`,
        'Sec-Fetch-Dest':'document','Sec-Fetch-Mode':'navigate',
        'Sec-Fetch-Site':'none','Upgrade-Insecure-Requests':'1',
      },
      redirect: 'follow',
    });
    const html = await resp.text();
    // Return raw HTML so we can see the structure
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch(err) {
    res.status(502).send(`Error: ${err.message}`);
  }
}
