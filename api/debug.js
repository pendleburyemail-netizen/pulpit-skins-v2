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
        'Sec-Fetch-Dest':'document',
        'Sec-Fetch-Mode':'navigate',
        'Sec-Fetch-Site':'none',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    const html = await response.text();

    // Count tables
    const tableMatches = html.match(/user-scores-table/g) || [];

    // Extract all table HTML chunks
    const tableChunks = [];
    let pos = 0;
    while (true) {
      const start = html.indexOf('<table', pos);
      if (start === -1) break;
      const end = html.indexOf('</table>', start) + 8;
      const chunk = html.slice(start, end);
      if (chunk.includes('user-scores-table')) {
        tableChunks.push(chunk.slice(0, 2000)); // first 2000 chars of each table
      }
      pos = end;
    }

    // Look for HCP-related text
    const hcpLines = [];
    html.split('\n').forEach((line, i) => {
      const l = line.toLowerCase();
      if (l.includes('handicap') || l.includes('hcp') || l.includes('index') || l.includes('course')) {
        hcpLines.push({ line: i, text: line.trim().slice(0, 200) });
      }
    });

    // Look for delta attributes
    const deltaMatches = (html.match(/delta="[^"]+"/g) || []).slice(0, 40);

    res.status(200).json({
      httpStatus:       response.status,
      finalUrl:         response.url,
      sessionSet:       !!session,
      sessionLength:    session.length,
      htmlLength:       html.length,
      hasScoreTable:    html.includes('user-scores-table'),
      tableCount:       tableMatches.length,
      deltaCount:       (html.match(/delta=/g)||[]).length,
      deltaExamples:    deltaMatches,
      hcpRelatedLines:  hcpLines.slice(0, 20),
      tableChunks,      // full table HTML for inspection
      fullHtml:         html.slice(0, 3000), // first 3000 chars
    });

  } catch(err) {
    res.status(200).json({ fetchError: err.message });
  }
}
