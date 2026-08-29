#!/usr/bin/env bash
# Writes the locked Erkner 70.3 race targets (race-plan-erkner-2026.md) into the
# athlete `goal` field so the Sunday Planner race-week module plans from them.
# Run locally where .env lives:  ./update-race-goal.sh
# PUT /athletes/:id only updates the fields sent — other athlete fields untouched.
set -euo pipefail

cd "$(dirname "$0")"
[ -f .env ] && set -a && . ./.env && set +a
: "${TRICOACH_API_KEY:?TRICOACH_API_KEY not set (put it in .env)}"
export DB_URL="${TRICOACH_DB_URL:-https://coach-db.arthurpfz.com}"
export ATHLETE_ID="${ATHLETE_ID:-1}"
export TRICOACH_API_KEY

echo "── Current goal field (backup this if you want it) ──"
curl -sS -H "x-api-key: $TRICOACH_API_KEY" "$DB_URL/athletes/$ATHLETE_ID" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).Goal||JSON.parse(d).goal||'(empty)'))"

GOAL=$(cat <<'EOF'
Erkner 70.3 (2026-09-13). Race plan locked 2026-08-29 from live data (CTL 23 after a low-volume August) — supersedes all earlier targets incl. 1:58/100m swim. Finish target ~6:00 (range 5:50-6:15).
SWIM 1.9km: 2:20/100m (~44min). Start 200m easy, draft, breathe every 3, long strokes.
BIKE 90km: 175-185W avg, HARD CAP 200W, HR cap 145. Segments: km0-10 @170W settle; km10-60 @180-185W; km60-80 @175-180W watch drift; km80-90 @165-170W spin 90+rpm. Nutrition from km10: 60-80g carbs + 500-750ml/h. ~3:00.
RUN 21.1km: ladder — km0-5 @6:10/km HR<=150 (hold it, no exceptions), km5-15 @5:55-6:00/km, km15+ free. Walk every aid station. ~2:05-2:08.
Key rule: first 90min of the race must feel embarrassingly easy. The two numbers: 185 and 6:10.
Pending test: 70min run w/ final 25min @5:50/km — HR<=160 stable = ladder confirmed; else shift +15s/km.
EOF
)

echo
echo "── Updating goal ──"
node -e '
const goal = process.argv[1];
fetch(process.env.DB_URL + "/athletes/" + process.env.ATHLETE_ID, {
  method: "PUT",
  headers: { "x-api-key": process.env.TRICOACH_API_KEY, "content-type": "application/json" },
  body: JSON.stringify({ goal })
}).then(r => r.json()).then(j => {
  console.log("Updated. New goal field:\n");
  console.log(j.Goal || j.goal);
}).catch(e => { console.error(e); process.exit(1); });
' "$GOAL"
