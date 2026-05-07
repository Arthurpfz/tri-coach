# Flex Weekly Planning — Migration Steps

This document is the cookbook for switching the system from **day-pinned weekly plans** (Mon-Sun columns, one session per day) to **a flexible session pool** with optional day-pinning (Rapha = pinned Tue, everything else floats). Once applied and the live system is running cleanly, this file can be deleted.

Source plan: [.claude/plans/concurrent-frolicking-galaxy.md](../../../.claude/plans/concurrent-frolicking-galaxy.md).

## Pre-flight

The DB code changes already landed in this branch (commit pending):
- `db/schema.sql` — `weekly_plans.sessions` (TEXT JSON), `sessions.plan_session_id` (TEXT)
- `db/server.js` — idempotent ALTER, `toPlanRow.sessions`, POST `/weekly-plans` accepts `sessions`, PATCH supports `plan_session_id`, `PRESERVE_ON_UPSERT` includes `plan_session_id`, GET `/sessions` accepts `date_to`

The n8n workflow changes below will fail until the DB rebuild ships, because they rely on the new fields.

---

## Step 1 — Deploy DB to VPS

```sh
# On the VPS (or via Relay command):
cd /data/tricoach-db
git pull          # if the repo there tracks origin; otherwise scp files
docker compose up -d --build
docker compose logs --tail 50 tricoach-db
```

Smoke checks:

```sh
curl -s -H "X-API-Key: $TRICOACH_API_KEY" \
  https://coach-db.arthurpfz.com/weekly-plans/latest?athlete_id=1 | jq '.sessions'
# expect: null   (no plans have a sessions column populated yet)

curl -s -H "X-API-Key: $TRICOACH_API_KEY" \
  -X POST -d '{"athlete_id":1,"week_start_date":"2026-12-31","sessions":[{"id":"smoke","sport":"Run","label":"KEY","duration_min":30,"description":"smoke"}]}' \
  -H "Content-Type: application/json" \
  https://coach-db.arthurpfz.com/weekly-plans | jq
# expect: 201 with sessions echoed back as an array

curl -s -H "X-API-Key: $TRICOACH_API_KEY" \
  -X PATCH -d '{"plan_session_id":"smoke"}' \
  -H "Content-Type: application/json" \
  https://coach-db.arthurpfz.com/sessions/1 | jq
# expect: {"ok":true} (or 404 if id 1 doesn't exist; in that case PATCH a real id)
```

When all three return as expected, proceed.

---

## Step 2 — Sunday Planner (`lUcAtn2oxCPkNkJ1`)

Open in n8n cloud UI. Make these node edits, then **Save**.

### 2a. `Get This Week Sessions` → rename to `Get Last Week Sessions`

This currently fetches sessions from `startOf('week')` (this Monday onwards). The planner runs Sunday evening, so what we actually want for adaptation is the week that's ending today.

Update the **query parameters**:

| Param | Old value | New value |
|---|---|---|
| `date_from` | `={{ $today.startOf('week').toFormat('yyyy-MM-dd') }}` | `={{ $today.startOf('week').minus({ weeks: 1 }).toFormat('yyyy-MM-dd') }}` |
| (add) `date_to` | — | `={{ $today.startOf('week').minus({ days: 1 }).toFormat('yyyy-MM-dd') }}` |
| `has_analysis` | (not set) | `1` |

(`limit=14` and `wrap=1` stay unchanged. Optionally rename the node to `Get Last Week Sessions` to avoid future confusion.)

### 2b. `Build Prompt Context` (Code node)

Replace the entire `jsCode` with:

```javascript
const athlete = $('Search records').first().json;
const wrapped = $json; // {sessions: [...], count: N}
const sessions = Array.isArray(wrapped.sessions) ? wrapped.sessions : [];

const lines = [];
if (sessions.length === 0) {
  lines.push('No sessions logged last week.');
} else {
  const totalMin = sessions.reduce((s, x) => s + (x.duration_min || 0), 0);
  const totalTSS = sessions.reduce((s, x) => s + (parseFloat(x.tss) || 0), 0);
  const grades = sessions.filter(x => x.grade).map(x => x.grade);
  lines.push(sessions.length + ' session' + (sessions.length > 1 ? 's' : '') +
             ' · ' + (totalMin / 60).toFixed(1) + 'h · TSS ' + Math.round(totalTSS));
  if (grades.length) lines.push('Grades: ' + grades.join(', '));
  sessions.slice().reverse().forEach(s => {
    const head = [
      (s.date || '').slice(5),
      s.sport || '?',
      s.duration_min ? s.duration_min + 'min' : null,
      s.tss ? 'TSS ' + Math.round(s.tss) : null,
      s.grade ? 'Grade ' + s.grade : null,
    ].filter(Boolean).join(' · ');
    lines.push('  - ' + head);
    if (s.analysis) {
      const oneLiner = String(s.analysis).split('\n').find(l => l.trim()) || '';
      if (oneLiner) lines.push('    ' + oneLiner.slice(0, 140));
    }
  });
}

return [{ json: { ...athlete, lastWeekSummary: lines.join('\n') } }];
```

The only change vs current: appends a one-line analysis snippet under each session (rich context for the next plan).

### 2c. `Basic LLM Chain` prompt

Replace the entire `text` parameter with:

```
=You are an expert Ironman Coach creating personalized weekly training plans.

=== ATHLETE PROFILE ===
- Name: {{ $json.Name }}
- Race: {{ $json['Race Name'] }} ({{ $json['Race Date'] }})
- Current Phase: {{ $json['Training Phase'] }}
- Fitness Profile: {{ $json['Fitness Profile'] }}

=== ATHLETE CONSTRAINTS ===
{{ $json.Constraints }}

=== LAST WEEK'S EXECUTION ===
{{ $json.lastWeekSummary }}

=== INSTRUCTIONS ===

1. **Constraints are non-negotiable.** Translate any "always Tuesday" / "non-negotiable Thursday" / recurring weekly anchor (e.g. Rapha club ride) into a session with `pinned_day` set to that weekday. Everything else is a flex pool — the athlete picks when to do them.

2. Generate **6-9 sessions** total for the upcoming week (no separate REST entries — rest = no session that day).

3. **Label every session** with exactly one of:
   - KEY: priority session, structured work, do not skip
   - OPTIONAL (Easy): can skip freely, Zone 2 only, 30-50min
   - OPTIONAL (Intensity): can skip, short intervals, 30-40min max

4. **Optional rules:**
   - Max 1x OPTIONAL (Intensity) per week.
   - OPTIONAL (Easy) is always Zone 2.

5. **Phase-appropriate focus:**
   - Base 1-2: aerobic endurance, technique (80-90% Z2)
   - Build 1-2: introduce intensity, sport-specific (70-80% Z2)
   - Peak: race simulation, sharpening
   - Taper: reduce volume, maintain some intensity

6. **Use exact values from Fitness Profile** (HR bpm, paces, watts, CSS).

7. **Adapt to LAST WEEK'S EXECUTION:**
   - C/F grades or low volume → trim load this week.
   - All A/B → stay the course or marginal increase within phase guidelines.
   - No sessions logged → plan conservatively.

8. **Session structure:** each session's `description` should specify duration, intensity targets, and a clear focus. KEY sessions include WU/MS/CD with specific numbers.

=== OUTPUT FORMAT ===
Return JSON only. No markdown, no code blocks, no extra prose.

{
  "focus": "1-2 sentence focus for this week",
  "sessions": [
    {
      "id": "kebab-case-stable-id",
      "label": "KEY",
      "sport": "Run | Ride | Swim | Workout",
      "duration_min": 60,
      "pinned_day": "Mon | Tue | Wed | Thu | Fri | Sat | Sun | null",
      "description": "Full session prescription with WU/MS/CD and targets."
    }
  ]
}

Rules for `id`: short, kebab-case, unique within the plan, descriptive (e.g. "rapha-ride", "long-run", "swim-css", "easy-run-1"). The athlete will see this id in match logs — make it readable.

Rules for `pinned_day`: only set when the athlete's constraints REQUIRE that day. Otherwise `null`.

=== EXAMPLES ===
{"id":"rapha-ride","label":"KEY","sport":"Ride","duration_min":90,"pinned_day":"Tue","description":"Rapha club ride. Z2/Z3 mixed, social pace. ~90min."}
{"id":"swim-css","label":"KEY","sport":"Swim","duration_min":55,"pinned_day":null,"description":"WU 10min easy. MS 6x200m @ CSS (2:05/100m), 30s rest. CD 5min easy."}
{"id":"long-run","label":"KEY","sport":"Run","duration_min":80,"pinned_day":null,"description":"Long Z2 run. 80min. HR 130-150bpm. Conversational, relaxed form."}
{"id":"easy-run-1","label":"OPTIONAL (Easy)","sport":"Run","duration_min":40,"pinned_day":null,"description":"Z2 (114-149bpm) treadmill. Conversational pace."}

Generate the training plan for NEXT WEEK (starting Monday).
```

### 2d. `Parse Json` (Set node)

No change needed — it parses LLM text into `plan` and downstream nodes use `JSON.parse(...).focus` and `JSON.parse(...).sessions` (was `.monday`, etc.).

### 2e. `Create a record` (POST `/weekly-plans`)

n8n's "Using Fields Below" body mode coerces array values into strings, which the server then stores as `[object Object]`-style garbage. Switch the body to **JSON mode**:

- In the node, find **Body Content Type** → `JSON`
- Toggle **Specify Body** → `Using JSON`
- Paste this single expression as the body:

```
={{ JSON.stringify({
  athlete_id: $('Search records').item.json.id,
  week_start_date: $today.endOf('week').plus({ days: 1 }).toFormat('yyyy-MM-dd'),
  focus: JSON.parse($('Parse Json').item.json.plan).focus,
  sessions: JSON.parse($('Parse Json').item.json.plan).sessions
}) }}
```

The server's POST `/weekly-plans` accepts `sessions` as either an array or a JSON-stringified TEXT — either form works.

### 2f. `Send a text message` (Telegram)

Replace the `text` parameter with:

```
=📅 *Training Plan | {{ $today.endOf('week').plus({ days: 1 }).toFormat('MMM d, yyyy') }}*

🎯 *Focus:* {{ JSON.parse($('Parse Json').item.json.plan).focus }}

{{ (() => {
  const sessions = JSON.parse($('Parse Json').item.json.plan).sessions || [];
  const pinned = sessions.filter(s => s.pinned_day);
  const flex = sessions.filter(s => !s.pinned_day);
  const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  pinned.sort((a,b) => dayOrder.indexOf(a.pinned_day) - dayOrder.indexOf(b.pinned_day));
  const fmt = s => '• ' + (s.pinned_day ? s.pinned_day + ' — ' : '') + s.label + ' · ' + s.sport + ' · ' + s.duration_min + 'min — ' + s.description;
  let out = '';
  if (pinned.length) out += '📌 *Pinned*\n' + pinned.map(fmt).join('\n') + '\n\n';
  if (flex.length) out += '🟦 *Flex pool*\n' + flex.map(fmt).join('\n');
  return out.trim();
})() }}

_Go crush it! 🚀_
```

If n8n complains about IIFE in expressions, replace the `{{ ... }}` block with a small Code node before the Telegram and reference its output instead.

---

## Step 3 — Daily Checkin (`hrSGUqoAwkWQ4gKl`)

### 3a. Add `Get Matched Sessions` node

Insert a new HTTP Request node between `Search Plan` and `Hardcore Analysis`.

- Method: `GET`
- URL: `https://coach-db.arthurpfz.com/sessions`
- Auth: same `Tricoach DB` httpHeaderAuth credential as Search Plan
- Query params:
  - `athlete_id` = `={{ $('Loop Over Users').item.json.id }}`
  - `date_from` = `={{ $today.startOf('week').toFormat('yyyy-MM-dd') }}`
  - `has_analysis` = `1`
  - `wrap` = `1`

Rewire connections: `Search Plan → Get Matched Sessions → Hardcore Analysis`.

### 3b. `Hardcore Analysis` prompt

Replace the entire `text` parameter with:

```
=You are an elite endurance coach. Match today's activity to the athlete's planned weekly session pool, then output a concise Telegram analysis.

=== ATHLETE ===
- Name: {{ $('Loop Over Users').item.json.Name }}
- Phase: {{ $('Loop Over Users').item.json['Training Phase'] }}
- Profile: {{ $('Loop Over Users').item.json['Fitness Profile'] }}

=== THIS WEEK'S PLAN (session pool) ===
Focus: {{ $('Search Plan').item.json.Focus }}
Sessions:
{{ JSON.stringify($('Search Plan').item.json.sessions || [], null, 2) }}

=== ALREADY MATCHED THIS WEEK ===
{{ (($('Get Matched Sessions').item.json.sessions || []).map(s => '- plan_session_id=' + (s.plan_session_id || 'null') + ' (' + s.sport + ', ' + (s.date||'') + ')').join('\n')) || '(none yet)' }}

=== TODAY'S ACTIVITY ===
Activity: {{ $('Get Activity Details').item.json.type }} - {{ $('Get Activity Details').item.json.name }}
Source: {{ $('Get Activity Details').item.json.source }}
Duration: {{ Math.round($('Get Activity Details').item.json.moving_time / 60) }}min
Distance: {{ $('Get Activity Details').item.json.distance ? ($('Get Activity Details').item.json.distance / 1000).toFixed(2) + 'km' : 'N/A' }}

{{ $('Get Activity Details').item.json.avg_watts ? 'Power: ' + Math.round($('Get Activity Details').item.json.avg_watts) + 'W avg / ' + Math.round($('Get Activity Details').item.json.weighted_avg_watts) + 'W NP / VI ' + $('Get Activity Details').item.json.variability_index.toFixed(2) : '' }}
{{ $('Get Activity Details').item.json.average_heartrate ? 'HR: ' + Math.round($('Get Activity Details').item.json.average_heartrate) + 'bpm avg / ' + Math.round($('Get Activity Details').item.json.max_heartrate) + 'bpm max / LTHR ' + $('Get Activity Details').item.json.lthr : '' }}
{{ $('Get Activity Details').item.json.icu_hr_zone_times ? 'HR zones (Z1-Z5+): ' + $('Get Activity Details').item.json.icu_hr_zone_times.map(t => Math.round(t/60) + 'min').join(' / ') : '' }}
{{ $('Get Activity Details').item.json.average_cadence || $('Get Activity Details').item.json.avg_run_cadence ? 'Cadence: ' + Math.round(($('Get Activity Details').item.json.average_cadence || $('Get Activity Details').item.json.avg_run_cadence) * ($('Get Activity Details').item.json.type === 'Run' ? 2 : 1)) + ($('Get Activity Details').item.json.type === 'Run' ? 'spm' : 'rpm') : '' }}
{{ $('Get Activity Details').item.json.average_speed && $('Get Activity Details').item.json.type === 'Run' ? 'Pace: ' + Math.floor(1000 / $('Get Activity Details').item.json.average_speed / 60) + ':' + String(Math.round((1000 / $('Get Activity Details').item.json.average_speed) % 60)).padStart(2, '0') + '/km' : '' }}
TSS: {{ $('Get Activity Details').item.json.icu_training_load ? Math.round($('Get Activity Details').item.json.icu_training_load) : 'N/A' }}
IF: {{ $('Get Activity Details').item.json.intensity ? $('Get Activity Details').item.json.intensity.toFixed(2) : 'N/A' }}

=== MATCHING RULES ===
1. Pick the best **unmatched** session (one whose `id` is NOT in ALREADY MATCHED) of the same sport.
2. If today is a session's `pinned_day` and the sport matches, prefer that session.
3. If no unmatched same-sport session exists, set `plan_session_id` to `null` and prefix the analysis with "⚠️ Off-plan — ".
4. Never re-use a `plan_session_id` already in ALREADY MATCHED.

=== ANALYSIS FORMAT ===
[sport-emoji] [Sport] · [duration]min · [distance]km · [avg HR]bpm · TSS [tss]
Grade: [A/B/C/F] — [one reason, ≤8 words]

• [insight 1 with a specific number]
• [insight 2 with a specific number]
• Limiter: [the one thing holding back progress]

Tomorrow: [session prescription ≤12 words, ideally pulled from another unmatched session in the pool]
Watch: [one metric to track next time ≤8 words]

EMOJI MAP: 🏃 Run · 🏊 Swim · 🚴 Ride/VirtualRide · 💪 Workout · ⛷️ NordicSki · 🚶 Walk · 🥾 Hike

RULES (enforce strictly):
- ZERO markdown — no **, no *, no __. Plain text only.
- Bullets are the literal • character.
- Max 8 lines total.
- Use only metrics provided above. Never invent numbers.
- Tone: rigorous, direct, no hedging, no generic praise.
- No preamble, no signoff.

=== OUTPUT (JSON ONLY) ===
{"plan_session_id":"<id from pool, or null>","grade":"A|B|C|F","message":"<full Telegram text with \n for newlines>"}

Rules:
- `grade` matches the Grade: line in the message.
- `message` is the complete Telegram text. If `plan_session_id` is null, the message must start with "⚠️ Off-plan — ".
- Do NOT wrap in ```json``` code blocks.
```

### 3c. `Parse Grade` (Set node) — extend

Add a third assignment alongside `grade` and `message`:

| Name | Type | Value |
|---|---|---|
| `plan_session_id` | string | `={{ (() => { try { const t = $json.text.replace(/```json[\s\S]*?```/g, s => s.replace(/```json\s*/,'').replace(/```\s*/,'')).replace(/```/g,'').trim(); const v = JSON.parse(t).plan_session_id; return v == null ? '' : v; } catch(e) { return ''; } })() }}` |

(Empty string represents null; the PATCH below converts it back.)

### 3d. `Save Analysis` (PATCH `/sessions/:id`) — switch to JSON body

To get a real `null` over the wire (parameter mode would send `""`), switch this node's body to JSON mode the same way as 2e:

- **Body Content Type** → `JSON`
- **Specify Body** → `Using JSON`
- Body:

```
={{ JSON.stringify({
  analysis: $('Parse Grade').item.json.message,
  analyzed_at: $now.toISO(),
  grade: $('Parse Grade').item.json.grade,
  plan_session_id: $('Parse Grade').item.json.plan_session_id || null
}) }}
```

`|| null` makes empty strings collapse to `null` in the JSON payload. The server's PATCH writes nulls correctly.

### 3e. `Send Telegram`

No change required — `message` already includes the `⚠️ Off-plan — ` prefix when applicable (per prompt rule).

---

## Step 4 — Backfill (`rHIyZMIJNAOqZvM2`)

Mirror Step 3 in this workflow. Differences from Daily Checkin:

1. The activity's date may be in a past week, so derive the relevant Monday from `Get Activity Details`'s `start_date_local`, not `$today`. The existing `Calculate Monday` node already does this — leave it.
2. `Get Matched Sessions` query should use the activity's week:
   - `date_from` = `={{ $('Calculate Monday').item.json.Monday_date }}`
   - `date_to` = `={{ DateTime.fromISO($('Calculate Monday').item.json.Monday_date).plus({ days: 6 }).toFormat('yyyy-MM-dd') }}`
   - `has_analysis` = `1`
   - `wrap` = `1`
3. Insert `Get Matched Sessions` between `Search Plan` and `Hardcore Analysis`.
4. Replace `Hardcore Analysis` prompt with the same text as 3b above. The two backfill-specific quirks already handled by the prompt (it just reads the plan + matched list + activity details — same shape as Daily Checkin).
5. Update `Parse Grade` and `Save Analysis` exactly as 3c and 3d.

Idempotency is preserved by the existing `Already Analyzed?` gate.

---

## Step 5 — Feedback Handler `/training` (`gAnJ0r3x0sFxqWxY`)

Open the `Format Training` Code node. Replace its `jsCode` with:

```javascript
const plan = $('Get Training Plan').first().json;
const arr = Array.isArray(plan) ? plan[0] : plan;
const sessions = (arr && arr.sessions) || [];
const focus = (arr && arr.Focus) || '';
const weekStart = (arr && arr['Week Start Date']) || '';

const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const pinned = sessions.filter(s => s.pinned_day);
const flex = sessions.filter(s => !s.pinned_day);
pinned.sort((a, b) => dayOrder.indexOf(a.pinned_day) - dayOrder.indexOf(b.pinned_day));

const fmt = s => '• ' +
  (s.pinned_day ? s.pinned_day + ' — ' : '') +
  s.label + ' · ' + s.sport + ' · ' + s.duration_min + 'min — ' + s.description;

let out = '📅 Training Plan | week of ' + weekStart + '\n';
if (focus) out += '🎯 Focus: ' + focus + '\n';
out += '\n';
if (pinned.length) out += '📌 Pinned\n' + pinned.map(fmt).join('\n') + '\n\n';
if (flex.length) out += '🟦 Flex pool\n' + flex.map(fmt).join('\n');

if (sessions.length === 0) {
  out = '📅 No plan found for this week. Run the Sunday Planner manually.';
}

return [{ json: { text: out.trim() } }];
```

Update `Send Training` Telegram node's `text` to `={{ $json.text }}` if it isn't already.

---

## Step 6 — End-to-end verification

In order:

1. **Manual Sunday Planner run** — n8n UI "Execute Workflow". Verify:
   - `Get Last Week Sessions` returns the prior week's data.
   - `Build Prompt Context` shows `lastWeekSummary` populated.
   - `Basic LLM Chain` returns valid JSON `{focus, sessions[]}`.
   - `Create a record` returns 201; in DB, the new row has non-null `sessions`, all Mo-Su columns null.
   - Telegram shows the pinned/flex layout. Manually verify Rapha (or whichever pin you put in athlete `Constraints`) appears under 📌 Pinned with the right day.

2. **`/training`** on Telegram — confirms the pool view.

3. **Daily Checkin** — manual run today. Verify:
   - Plan + matched-sessions context fetched.
   - LLM picks a `plan_session_id` from the pool.
   - DB row's `plan_session_id` is set after PATCH.
   - Telegram message renders normally.
   - Trigger again the same day → idempotency gate short-circuits (no second analysis).

4. **Off-plan path** — record an activity that doesn't match any pool session (e.g. a hike if no Workout in pool). Verify Telegram message is prefixed `⚠️ Off-plan — ` and `plan_session_id` is null in DB.

5. **`/refresh`** — last 7 days, with a mix of analyzed and unanalyzed activities. Verify already-analyzed sessions are skipped; new ones get matched without duplicating prior matches.

6. **Cross-week regression** — run `/refresh` for an old session that pre-dates the migration. The plan for that week has no `sessions` column → grading should still produce an analysis but with `plan_session_id: null` (the pool is empty). Confirm no crash.

If any LLM JSON parse fails, the error workflow `psyVgPiGJoO5QOa4` will fire a Telegram alert.

---

## Rollback

If a step fails badly:
- DB: the new columns are additive; rolling back code does not require dropping columns.
- Workflows: each one is versioned in n8n cloud — use "Workflow History" to restore the prior published version.
- The Mon-Sun columns still exist and are still served by `toPlanRow`. Pre-migration plans continue to render correctly via `/training` (the new Format Training falls back to "no plan found" if `sessions` is null — adjust to read Mo-Su as a fallback if you need a softer transition).
