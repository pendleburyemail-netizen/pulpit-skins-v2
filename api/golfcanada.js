// Golf Canada API proxy — complete integration
// Handles login, friends list, score history, and hole-by-hole data
// Credentials stored in Vercel environment variables

const GC_BASE     = 'https://scg.golfcanada.ca';
const MEMBER_ID   = '2292439'; // Greg Pendlebury — authenticated account

async function getToken() {
  const username = process.env.GC_USERNAME;
  const password = process.env.GC_PASSWORD;
  if (!username || !password) throw new Error('GC_USERNAME or GC_PASSWORD not set in Vercel env vars');
  const res = await fetch(`${GC_BASE}/connect/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'password', username, password,
      scope: 'address email offline_access openid phone profile roles',
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GC login failed (${res.status}): ${t.slice(0,200)}`);
  }
  return (await res.json()).access_token;
}

function gcHeaders(token) {
  return {
    'Authorization':    `Bearer ${token}`,
    'Accept':           'application/json, text/plain, */*',
    'Accept-Language':  'en-CA,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
  };
}

async function gcGet(token, path) {
  const res = await fetch(`${GC_BASE}${path}`, { headers: gcHeaders(token) });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `GC ${res.status} on ${path}`);
  }
  return res.json();
}

// Extract 18 gross scores from Golf Canada holeScores array
// Filters out summary rows (9.1=front total, 18.1=back total, 18.2=grand total)
function extractGrossScores(holeScores) {
  const gross = {};
  if (!Array.isArray(holeScores)) return gross;
  holeScores.forEach(h => {
    const num = h.number;
    if (Number.isInteger(num) && num >= 1 && num <= 18 && h.gross != null) {
      gross[num] = h.gross;
    }
  });
  return gross;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action, individualId, scoreId, targetDate } = req.query;

  try {
    const token = await getToken();

    // ── getFriends ────────────────────────────────────────────────────────
    if (action === 'getFriends') {
      const friends = await gcGet(token, `/api/members/${MEMBER_ID}/getFriends`);
      return res.status(200).json(friends);
    }

    // ── getHistory ────────────────────────────────────────────────────────
    if (action === 'getHistory') {
      if (!individualId) return res.status(400).json({ error: 'individualId required' });
      const history = await gcGet(token,
        `/api/scores/getHistory?$skip=0&$top=20&individualId=${individualId}`
      );
      if (!targetDate) return res.status(200).json(history);
      const target = targetDate.slice(0,10);
      const match  = history.data?.find(r => r.date?.slice(0,10) === target);
      return res.status(200).json({ matched:!!match, round:match||null, allDates:history.data?.slice(0,5).map(r=>r.date?.slice(0,10)) });
    }

    // ── getScoreData ──────────────────────────────────────────────────────
    if (action === 'getScoreData') {
      if (!individualId || !scoreId) return res.status(400).json({ error: 'individualId and scoreId required' });
      const data = await gcGet(token, `/api/scores/getScoreData?individualId=${individualId}&scoreId=${scoreId}`);
      return res.status(200).json(data);
    }

    // ── fetchAll — main action ────────────────────────────────────────────
    // Gets friends list + Greg's own data, matches rounds by date
    if (action === 'fetchAll') {
      if (!targetDate) return res.status(400).json({ error: 'targetDate required (YYYY-MM-DD)' });
      const target  = targetDate.slice(0,10);

      // Fetch friends list and Greg's own profile in parallel
      const [friends, gregProfile] = await Promise.all([
        gcGet(token, `/api/members/${MEMBER_ID}/getFriends`),
        gcGet(token, `/api/scores/getProfile?individualId=${MEMBER_ID}`),
      ]);

      // Build full player list: Greg + his friends
      const allPlayers = [
        {
          individualId: parseInt(MEMBER_ID),
          name:         gregProfile.name || 'Greg Pendlebury',
          handicap:     gregProfile.handicap,
          club:         gregProfile.club?.name || 'The Pulpit Club',
        },
        ...friends,
      ];

      const results = await Promise.all(allPlayers.map(async friend => {
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
              recentDates:  history.data?.slice(0,3).map(r => ({
                date:   r.date?.slice(0,10),
                course: r.course,
                tee:    r.tee,
              })),
            };
          }

          // Return round info without hole data — hole data fetched separately below
          return {
            individualId: friend.individualId,
            name:         friend.name,
            handicap:     friend.handicap,
            found:        true,
            round,
            needsHoleData: true,
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

      // Fetch hole-by-hole data sequentially for matched players to avoid timeout
      for (const result of results) {
        if (!result.needsHoleData) continue;
        let grossScores = {};
        let holeDataError = null;
        try {
          const holeData = await gcGet(token,
            `/api/scores/getScoreData?individualId=${result.individualId}&scoreId=${result.round.id}`
          );
          grossScores = extractGrossScores(holeData?.score?.holeScores);
        } catch(e) {
          holeDataError = e.message;
        }
        delete result.needsHoleData;
        result.grossScores  = grossScores;
        result.holesFound   = Object.keys(grossScores).length;
        result.holeDataError = holeDataError;
        result.round = {
          id:           result.round.id,
          date:         result.round.date?.slice(0,10),
          course:       result.round.course,
          tee:          result.round.tee,
          score:        result.round.score,
          rating:       result.round.rating,
          slope:        result.round.slope,
          differential: result.round.differential,
        };
      }

      return res.status(200).json({ targetDate:target, memberCount:allPlayers.length, results });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
