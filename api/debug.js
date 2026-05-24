export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

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
      redirect: 'follow',
    });

    const html = await response.text();

    // Count score tables
    const tableCount = (html.match(/user-scores-table/g)||[]).length;

    // Extract ALL delta cells in order — this is what the parser actually sees
    const deltaPattern = /delta="([^"]*)"[^>]*>([\s\S]*?)<\/td>/g;
    const allDeltas = [];
    let m;
    while((m=deltaPattern.exec(html))!==null){
      const txt = m[2].replace(/<[^>]+>/g,'').trim();
      allDeltas.push({delta:m[1], text:txt});
    }

    // Extract all rows containing "Net Score" or "Gross Score"
    const rowPattern = /<tr>([\s\S]*?)<\/tr>/g;
    const scoreRows = [];
    while((m=rowPattern.exec(html))!==null){
      const row = m[1];
      if(row.includes('Net Score')||row.includes('Gross Score')){
        // pull all cell text values
        const cellTexts = [...row.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/g)]
          .map(c=>c[1].replace(/<[^>]+>/g,'').trim())
          .filter(t=>t);
        scoreRows.push(cellTexts.slice(0,12));
      }
    }

    // Extract all th text in score tables
    const thTexts = [...html.matchAll(/<th[^>]*>\s*<div[^>]*>([^<]+)<\/div>/g)]
      .map(m=>m[1].trim()).slice(0,30);

    // Look for HCP/index numbers anywhere in the page
    const hcpMatches = [];
    const hcpPattern = /([Hh]andicap|[Ii]ndex|HCP|hcp|[Cc]ourse)[^<]{0,30}?([0-9]+\.?[0-9]*)/g;
    while((m=hcpPattern.exec(html))!==null){
      hcpMatches.push(m[0].replace(/<[^>]+>/g,'').trim().slice(0,80));
    }

    // Full HTML — split into chunks for readability
    res.status(200).json({
      httpStatus:   response.status,
      sessionSet:   !!session,
      tableCount,
      deltaCount:   allDeltas.length,
      firstDeltas:  allDeltas.slice(0,30),  // first 30 delta cells in page order
      scoreRows,                             // Net/Gross rows with cell values
      thTexts,                              // all th content
      hcpMatches:   hcpMatches.slice(0,15),
      html0_2000:   html.slice(0,2000),
      html2000_4000:html.slice(2000,4000),
      html4000_6000:html.slice(4000,6000),
    });

  } catch(err) {
    res.status(200).json({fetchError:err.message});
  }
}
