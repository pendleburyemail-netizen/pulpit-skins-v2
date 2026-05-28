// Golf Canada API proxy
// Handles login, token refresh, friends list, score history and hole-by-hole data
// Credentials stored in Vercel environment variables (never in code)

const GC_BASE = 'https://scg.golfcanada.ca';
const MY_MEMBER_ID = '2292439'; // Greg Pendlebury's Golf Canada member ID

// Cache token in module scope (survives within a single Vercel function instance)
let cachedToken = null;
let tokenExpiry  = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const username = process.env.GC_USERNAME;
  const password = process.env.GC_PASSWORD;
  if (!username || !password) throw new Error('GC_USERNAME or GC_PASSWORD not set in Vercel environment variables');

  const body = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    scope: 'address email offline_access openid phone profile roles',
  });

  const res  = await fetch(`${GC_BASE}/connect/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Golf Canada login failed: ${res.status} — ${text.slice(0,200)}`);
  }

  const data   = await res.json();
  cachedToken  = data.access_token;
  // expires_in is in seconds; refresh 60s early
  tokenExpiry  = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

function gcHeaders(token) {
  return {
    'Authorization':   `Bearer ${token}`,
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'en-CA,en;q=0.9',
    'X-Requested-With':'XMLHttpRequest',
  };
}

async function gcGet(token, path) {
  const res = await fetch(`${GC_BASE}${path}`, { headers: gcHeaders(token) });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `GC API error ${res.status} on ${path}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action, individualId, scoreId, targetDate } = req.query;

  try {
    const token = await getToken();

    // ── Action: getFriends ────────────────────────────────────────────────
    // Returns all friends with name, individualId, handicap index
    if (action === 'getFriends') {
      const friends = await gcGet(token, `/api/members/${MY_MEMBER_ID}/getFriends`);
      return res.status(200).json(friends);
    }

    // ── Action: getHistory ────────────────────────────────────────────────
    // Returns scoring history for a friend, optionally filtered by date
    // Finds the round matching targetDate and returns its scoreId
    if (action === 'getHistory') {
      if (!individualId) return res.status(400).json({ error: 'individualId required' });
      const history = await gcGet(token,
        `/api/scores/getHistory?$skip=0&$top=20&individualId=${individualId}`
      );

      if (!targetDate) return res.status(200).json(history);

      // Find the round matching the target date
      const target = targetDate.slice(0, 10); // YYYY-MM-DD
      const match  = history.data?.find(r => r.date?.slice(0,10) === target);

      return res.status(200).json({
        matched:  !!match,
        round:    match || null,
        allDates: history.data?.slice(0,5).map(r => ({ date:r.date?.slice(0,10), course:r.course, tee:r.tee, score:r.score, id:r.id })),
      });
    }

    // ── Action: getScoreData ──────────────────────────────────────────────
    // Returns hole-by-hole data for a specific round
    if (action === 'getScoreData') {
      if (!individualId || !scoreId) return res.status(400).json({ error: 'individualId and scoreId required' });
      const data = await gcGet(token,
        `/api/scores/getScoreData?individualId=${individualId}&scoreId=${scoreId}`
      );
      return res.status(200).json(data);
    }

    // ── Action: getProfile ────────────────────────────────────────────────
    if (action === 'getProfile') {
      if (!individualId) return res.status(400).json({ error: 'individualId required' });
      const profile = await gcGet(token, `/api/scores/getProfile?individualId=${individualId}`);
      return res.status(200).json(profile);
    }

    // ── Action: fetchAll ──────────────────────────────────────────────────
    // Main action: get friends list + match each friend's round for targetDate
    // Returns everything needed for the skins calculation in one call
    if (action === 'fetchAll') {
      if (!targetDate) return res.status(400).json({ error: 'targetDate (YYYY-MM-DD) required' });

      const friends = await gcGet(token, `/api/members/${MY_MEMBER_ID}/getFriends`);
      const target  = targetDate.slice(0, 10);

      const results = await Promise.all(friends.map(async friend => {
        try {
          const history = await gcGet(token,
            `/api/scores/getHistory?$skip=0&$top=20&individualId=${friend.individualId}`
          );
          const round = history.data?.find(r => r.date?.slice(0,10) === target);

          if (!round) {
            return {
              individualId: friend.individualId,
              name:         friend.name,
              handicap:     friend.handicap,
              found:        false,
              round:        null,
              holeData:     null,
              recentDates:  history.data?.slice(0,3).map(r=>r.date?.slice(0,10)),
            };
          }

          // Fetch hole-by-hole data for the matched round
          let holeData = null;
          try {
            holeData = await gcGet(token,
              `/api/scores/getScoreData?individualId=${friend.individualId}&scoreId=${round.id}`
            );
          } catch(e) {
            holeData = { error: e.message };
          }

          return {
            individualId: friend.individualId,
            name:         friend.name,
            handicap:     friend.handicap,
            found:        true,
            round: {
              id:           round.id,
              date:         round.date?.slice(0,10),
              course:       round.course,
              tee:          round.tee,
              score:        round.score,
              rating:       round.rating,
              slope:        round.slope,
              differential: round.differential,
            },
            holeData,
          };
        } catch(e) {
          return {
            individualId: friend.individualId,
            name:         friend.name,
            handicap:     friend.handicap,
            found:        false,
            error:        e.message,
          };
        }
      }));

      return res.status(200).json({
        targetDate: target,
        memberCount: friends.length,
        results,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}. Use getFriends, getHistory, getScoreData, getProfile, or fetchAll` });

  } catch(err) {
    // If token error, clear cache so next request retries login
    if (err.message.includes('login failed')) {
      cachedToken = null; tokenExpiry = 0;
    }
    res.status(500).json({ error: err.message });
  }
}
