// Test Golf Canada integration — fetches all friends' Week 2 data
// GET /api/gctest?date=2026-05-27

const GC_BASE = 'https://scg.golfcanada.ca';
const MY_MEMBER_ID = '2292439';

async function getToken() {
  const username = process.env.GC_USERNAME;
  const password = process.env.GC_PASSWORD;
  if (!username || !password) throw new Error('GC_USERNAME or GC_PASSWORD not set in Vercel env vars');

  const res = await fetch(`${GC_BASE}/connect/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'password',
      username,
      password,
      scope: 'address email offline_access openid phone profile roles',
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GC login failed: ${res.status} — ${t.slice(0,200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

function headers(token) {
  return {
    'Authorization':    `Bearer ${token}`,
    'Accept':           'application/json, text/plain, */*',
    'Accept-Language':  'en-CA,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
  };
}

async function get(token, path) {
  const res = await fetch(`${GC_BASE}${path}`, { headers: headers(token) });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `GC ${res.status} on ${path}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const targetDate = (req.query.date || '2026-05-27').slice(0,10);

  try {
    const token   = await getToken();
    const [friends, gregProfile] = await Promise.all([
      get(token, `/api/members/${MY_MEMBER_ID}/getFriends`),
      get(token, `/api/scores/getProfile?individualId=${MY_MEMBER_ID}`),
    ]);

    const allPlayers = [
      { individualId: parseInt(MY_MEMBER_ID), name: gregProfile.name || 'Greg Pendlebury', handicap: gregProfile.handicap },
      ...friends,
    ];

    const results = await Promise.all(allPlayers.map(async friend => {
      try {
        // Get score history
        const history = await get(token,
          `/api/scores/getHistory?$skip=0&$top=10&individualId=${friend.individualId}`
        );
        const round = history.data?.find(r => r.date?.slice(0,10) === targetDate);

        if (!round) {
          return {
            name:        friend.name,
            individualId:friend.individualId,
            handicap:    friend.handicap,
            found:       false,
            recentDates: history.data?.slice(0,3).map(r=>({date:r.date?.slice(0,10),course:r.course,tee:r.tee})),
          };
        }

        // Get hole-by-hole data
        let holeData = null;
        try {
          holeData = await get(token,
            `/api/scores/getScoreData?individualId=${friend.individualId}&scoreId=${round.id}`
          );
        } catch(e) {
          holeData = { error: e.message };
        }

        return {
          name:        friend.name,
          individualId:friend.individualId,
          handicap:    friend.handicap,
          found:       true,
          round: {
            id:     round.id,
            date:   round.date?.slice(0,10),
            course: round.course,
            tee:    round.tee,
            score:  round.score,
            rating: round.rating,
            slope:  round.slope,
          },
          holeData,
        };
      } catch(e) {
        return { name:friend.name, individualId:friend.individualId, error:e.message };
      }
    }));

    res.status(200).json({ targetDate, results });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
