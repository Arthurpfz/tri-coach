# Tri Coach - AI-Powered Triathlon Coaching System

## Project Overview

This is an **automated triathlon coaching system** that creates personalized weekly training plans and provides daily performance feedback by analyzing Strava activities against planned workouts.

**Status:** Production (Active)
**Author:** Arthur Pfalzgraf
**Primary Athlete:** Arthur Pfalzgraf

---

## System Architecture

### Tech Stack

- **N8N Cloud**: Workflow automation platform (https://apfz.app.n8n.cloud)
- **Tricoach DB**: Self-hosted SQLite REST API at https://coach-db.arthurpfz.com
  - Code: `./db/` — Node 20 + Express + `better-sqlite3`
  - Deployed: `/data/tricoach-db/` on Hostinger VPS (IP in `.env` as `VPS_IP`)
  - Auth: `X-API-Key` header (n8n credential ID `6GNzKYNE1JAz77RL`)
- **Intervals.icu**: Primary training data source (full FIT metrics)
- **Strava API**: Legacy fallback, OAuth tokens still stored for compatibility
- **Claude AI**: Coaching intelligence (via OpenRouter)
  - Models: Claude Sonnet 4.6 (check-ins), Claude Opus 4.7 (planning)
- **Telegram**: Communication channel (Chat ID stored in `.env` as `TELEGRAM_CHAT_ID`)

### Data Flow

```
Sunday 8:45 PM → Generate Weekly Plan → POST /weekly-plans → Send to Telegram (after daily recap + stats)
Daily 8:10 PM → GET /athletes → GET /weekly-plans → Intervals.icu → AI Analysis
              → PUT /athletes/:id (last_coaching_date) → Telegram feedback
```

---

## Active Workflows

### 0. Coach Tri - Error Handler
- **ID:** psyVgPiGJoO5QOa4
- **Type:** Error Trigger workflow
- **Status:** ✅ Active
- **Purpose:** Catches failures from all Coach Tri workflows, sends Telegram alert with workflow name, failing node, and error message
- **Wired to:** All Coach Tri workflows via `settings.errorWorkflow` (Daily Checkin ICU, Sunday Planner, Weekly Stats, Backfill, Feedback Handler)
- **Note:** Only fires on automated (scheduled) runs, NOT manual executions — by n8n design

### 1. ~~Coach Tri - Daily Checkin (Strava - LEGACY)~~ — DELETED 2026-06-06
- Workflow `Q2KE0XGsc8NWLY8V` deleted. Intervals.icu (1b) is the sole daily check-in.
- Reason: Strava's new Developer Program (effective 2026-06-30) requires a Strava subscription for Standard Tier API access, and the workflow hadn't been the analysis source since Jan 2026. See [feedback_strava_deprecation.md](../../../.claude/projects/-Users-arthurpfalzgraf-Desktop-Projects-TRI-COACH/memory/feedback_strava_deprecation.md).
- DB columns (`strava_access_token`, `strava_refresh_token`, `strava_id`, `sessions.source='strava'`) left in place — dormant, no migration needed.

### 1b. Coach Tri - Daily Checkin (Intervals.icu) ⭐
- **ID:** hrSGUqoAwkWQ4gKl
- **URL:** https://apfz.app.n8n.cloud/workflow/hrSGUqoAwkWQ4gKl
- **Schedule:** Daily at 20:10 (Europe/Berlin)
- **Purpose:** Advanced technical analysis with full FIT file data
- **Status:** ✅ Active and Tested (2026-01-25)
- **AI Model:** Claude Sonnet 4.6 (OpenRouter `anthropic/claude-sonnet-4.6`)

**Idempotency & error handling (added 2026-04-18):**
- `Already Coached Today?` gate short-circuits if `Last Coaching Date` == today
- `Update Coaching Date` writes today's date immediately after gate passes (before `Get Activities`) — covers rest days and survives downstream failures
- `errorWorkflow` → `psyVgPiGJoO5QOa4` for Telegram alerts on failure
- `Get Activities` URL uses `$('Loop Over Users').item.json['Intervals.icu Athlete ID']` (survives node reordering)

**Session persistence + analysis store (added 2026-04-25):**
- `Filter Activities` (drops `source == 'ZEPP'`) sits between `Get Activities` and the loop — armband recordings are excluded entirely (they overlap with COROS/WAHOO recordings of the same effort, producing duplicate analyses)
- `Save Session` (POST `/sessions`) upserts the activity into the `sessions` table on `(athlete_id, intervals_id)` — full FIT payload across ~45 columns + `raw_json`
- `Save Analysis` (PATCH `/sessions/:id`) writes Claude's coaching output into `analysis` + `analyzed_at` after the LLM runs, before Telegram
- Rest-day branch: `Check Activities Exist → false → Send Rest-Day Telegram` ("🛌 No activity logged today...")
- Telegram output rewritten as plain-text bulleted format (sport emoji header · Grade · 3 bullets · Tomorrow · Watch) — no markdown, ~6 lines, fits one Telegram screen

**Readiness + auto test detection (added 2026-07-12, in Daily Checkin AND Backfill — nodes byte-identical):**
- `Get Wellness` (ICU `/wellness`, 7-day window ending on the session date, `fullResponse+neverError` so the array response stays one item) → `Build Readiness` (Code, per-item) builds `readinessLine` — `Sleep 6h48 (score 68) · HRV 55 (7d avg 88) · RHR 58 (7d avg 63)` — consumed by the prompt's `=== READINESS ===` block. Rule: readiness colors tone + the Tomorrow line ONLY, never the grade.
- `=== TEST DETECTION ===` prompt section: unambiguous fitness tests (400m swim TT → CSS = time/4; 20min max bike → FTP = 0.95×power; all-out 5K → run threshold) emit `detected_test` in the output JSON (`{"kind","value","evidence"}`, null when in doubt). `Parse Grade` extracts it → `Has Test? → Apply Test Update (Code) → Update Athlete Profile (PUT /athletes/:id) → Send Test Update` Telegram (`📈 FTP updated 261 → 268W (…)`). Apply Test Update regex-replaces the value everywhere it appears across the four free-text athlete fields (`fitness_profile`, `goal`, `constraints`, `health_status`) — patterns tested against live field text; percentages ("88-94% FTP") and race targets ("1:58/100m") are not touched.
- **Data Source:** Intervals.icu API (full FIT file metrics + time-series streams)
- **Credential ID:** ms91wbaCvecB3tqQ (HTTP Basic Auth)

**IMPORTANT - Data Source Requirements:**
- Activities must come from **direct device uploads** to Intervals.icu
- Supported: COROS, Wahoo, Garmin (direct), Zwift (direct connection)
- **Strava must be disconnected** from Intervals.icu
- Reason: Intervals.icu API blocks access to Strava-sourced activities
- Activities uploaded via Strava will not be analyzed by this workflow

**Workflow Flow:**
1. Fetch all users from Tricoach DB (`GET /athletes`)
2. Loop through each user
3. Fetch today's activities from Intervals.icu API using athlete ID
4. Check if activities exist (type validation enabled)
5. Loop through activities
6. Fetch detailed activity data with full FIT metrics:
   - Power (avg, normalized, VI, max)
   - Heart rate (avg, max, LTHR, zone distribution)
   - Cadence (consistency analysis)
   - Pace/speed metrics
   - Training load (TSS, IF, TRIMP)
   - Interval structure (auto-detected)
   - Available streams (time-series data)
7. Calculate current week's Monday date
8. Fetch weekly plan from Tricoach DB (`GET /weekly-plans?athlete_id=&week_start_date=`)
9. Send comprehensive data to Claude Sonnet 4.6 with rigorous analysis framework
10. Claude performs technical analysis (post-2026-05-10):
    - **Session quality grading** (A/B/C/F vs fitness profile — NOT plan adherence)
    - Power analysis (VI, decoupling, pacing strategy)
    - Cardiovascular analysis (cardiac drift, efficiency factor, HR zones)
    - Cadence assessment (consistency, sport-specific appropriateness)
    - Interval quality (structure, consistency across reps)
    - Training phase context and progression
    - Specific coaching points with exact metrics
    - Plan-matching (`plan_session_id`) for tracking only — does NOT influence grade or wording
11. Send Telegram-native bulleted message via Telegram

**Output Style (post-2026-05-10):**
- Format: sport emoji header · Grade line · 3 bullets · Tomorrow · Watch (~6-8 lines)
- Plain text, no markdown, literal • bullets
- **Grade = session quality vs fitness profile, NOT plan adherence** (see [feedback_no_plan_grading.md](../../../../.claude/projects/-Users-arthurpfalzgraf-Desktop-Projects-TRI-COACH/memory/feedback_no_plan_grading.md))
- Plan is indicative — never use "⚠️ Off-plan" prefix; never scold deviation
- Mention plan only if it adds genuine context (e.g. "swapped today's swim for a ride — fine"); default to silence about it
- Rigorous, descriptive, data-driven; no fluff, no moralizing, no generic praise

**Grade rubric:**
- A — Clean execution: zones held, pacing controlled, cadence in target, no major flags
- B — Solid with one notable flag (mild drift, minor zone leak, slightly off cadence)
- C — Significant issues (poor pacing, big zone leaks, mechanical inefficiency)
- F — Broken session (abandoned, injury risk, severe overreach, data corruption)

**Example Feedback:**
```
🚴 Ride · 90min · 38.5km · 152bpm · TSS 78
Grade: A — Clean Z2 with disciplined cadence

• Power 245W avg / 258W NP / VI 1.05 — textbook steady pacing
• Cadence held 90-94rpm with <3% variation across 90min
• Limiter: last 20min saw 8W power drop while HR held — glycogen depletion likely

Tomorrow: Easy spin 45min Z2 or rest
Watch: Late-ride power decay vs fueling
```

### 1d. Coach Tri - Weekly Stats
- **ID:** 2W0SIHwzyAWJW62Q
- **URL:** https://apfz.app.n8n.cloud/workflow/2W0SIHwzyAWJW62Q
- **Schedule:** Daily at 20:30 (Europe/Berlin)
- **Purpose:** Send a single Telegram with cumulative weekly volume — total hours (one 🔥 per hour) + per-sport breakdown
- **Status:** ✅ Active (deployed 2026-04-25)
- **Flow:** Schedule Trigger → Calculate Monday → GET `/sessions?athlete_id=1&date_from=<monday>` → Code (aggregate by sport) → Send Telegram
- **Output format:**
  ```
  📊 Week to date
  🔥🔥🔥🔥 4:26h total

  🏃 Run · 1:08
  🏊 Swim · 1:20
  🚴 Ride · 0:00
  💪 Workout · 1:58
  ```
- **Volume nudge (added 2026-06-06):** `Format Stats` appends a day-aware nudge toward the 6–8h goal. From midweek on (dow ≥ 3), if logged hours are <70% of the prorated pace to the 6h floor, it adds `⚡ Xh to go for your 6h floor — N days left.`; once ≥6h it switches to `✅ 6h goal hit — push toward 8h…`. Mon/Tue or on-pace → no nudge. Uses the fixed 6–8h band (not the planner's ramped target).
- **Run cadence trend (added 2026-07-12):** `Get Sessions` now fetches 56 days (`limit=300`); `Format Stats` filters the running week client-side for the totals and appends `🦵 Run cadence 149 spm (-1 vs prior month · target 175-180)` — duration-weighted avg of runs ≥10min, last 28d vs prior 28d. **`avg_cadence` is stored as half-spm for runs — always ×2** (bike rpm is true as-is). Line omitted when no runs with cadence in the window. Same logic in `/strikes` (`Format Strikes`).
- **Wired to** `errorWorkflow` (`psyVgPiGJoO5QOa4`)

### 1e. Coach Tri - Backfill (/refresh) ⭐
- **ID:** rHIyZMIJNAOqZvM2
- **Trigger:** Execute Workflow Trigger — invoked from Feedback Handler when user sends `/refresh` on CroissantTri bot
- **Purpose:** Manual catch-up for late-uploaded activities (e.g. bike computer didn't sync to Intervals.icu in time)
- **Status:** ✅ Active (deployed 2026-05-01)
- **AI Model:** Claude Sonnet 4.6 (same prompt as Daily Checkin)

**Flow:**
1. Send "🔄 Catching up last 7 days…" ack to chat
2. Fetch athletes → loop over users (splitInBatches v3, outer only)
3. `GET /athlete/:id/activities?oldest=today-7&newest=today` from Intervals.icu
4. Filter `source == 'ZEPP'` (drops armband duplicates)
5. **Per-item natural cascade** (no inner splitInBatches — see "Triplet bug" below):
   - Get Activity Details (per item)
   - Save Session — `POST /sessions` returns `{id, analyzed_at}`
   - **Already Analyzed?** IF gate on `analyzed_at` is empty → run analysis; else skip silently
6. Calculate Monday (of activity's start_date_local, not today — gets the right week's plan)
7. Search Plan → … → Get Wellness → Build Readiness → Hardcore Analysis → Parse Grade → Save Analysis (PATCH) → Send Telegram (with 📅 date prefix); `Has Test?` branch off Parse Grade for auto profile updates (see 1b)
8. After Backfill returns to Feedback Handler → "✅ Refresh complete." sent reliably whether 0 or N analyses ran

**Idempotency guarantee:** spamming `/refresh` is safe. Already-analyzed sessions short-circuit at the `analyzed_at` gate. The only side effect of a re-run is a fresh Save Session upsert that preserves `analysis`/`analyzed_at`/`grade`/`rpe`/`notes`/`user_feedback*` (see `PRESERVE_ON_UPSERT` in `db/server.js`).

**Triplet bug (avoided):** initial design used a nested splitInBatches v3 for activities. With >1 activity, the loop-back wiring (`out1 → Get Activities`) accumulated items across cycles and dumped all duplicates at once, producing N×N analyses. Fixed by removing the inner loop entirely and relying on n8n's natural per-item cascade. Daily Checkin doesn't hit this because it almost always has 1 activity per day.

**Wired to:** Feedback Handler (`gAnJ0r3x0sFxqWxY`) routes `/refresh` here via Execute Workflow node. Error workflow `psyVgPiGJoO5QOa4`. Also invoked nightly by 1g (Nightly Reconciliation) with `{silent: true}`.

**Silent mode (added 2026-07-12):** `Silent Mode?` IF gate between `When Called` and `Send Ack` — when the caller passes `silent: true`, the "🔄 Catching up…" ack is skipped and flow goes straight to `Search Users`. Per-session analysis Telegrams still send (chat IDs fall back to Arthur's chat). `/refresh` via Feedback Handler passes no `silent` flag → ack behaves as before.

### 1g. Coach Tri - Nightly Reconciliation ⭐
- **ID:** Lo3H8B1TRbkSE2ZM
- **Schedule:** Daily at 07:45 (Europe/Berlin)
- **Purpose:** Automates `/refresh` — catches late device syncs and multi-session days that the 20:10 Daily Checkin misses (root cause of the recurring "you didn't record my swim / open water" reports; see vault `wiki/outputs/skill-audit-2026-07.md`)
- **Flow:** Schedule Trigger → Set Silent (`{silent: true}`) → Execute Workflow → Backfill (1e). Nothing missed = zero messages; missed sessions arrive as normal 📅-prefixed analyses next morning.
- **Status:** ✅ Active (deployed 2026-07-12)
- Error workflow `psyVgPiGJoO5QOa4`.

### 1f. Coach Tri - Feedback Handler (command router)
- **ID:** gAnJ0r3x0sFxqWxY
- **Trigger:** Telegram Trigger on CroissantTri bot (cred `9IpAp35yJmIQJpeA`) — listens to all messages
- **Purpose:** Single Telegram webhook acting as a command router. Inline branches for stateless commands; sub-workflow call for the heavy `/refresh` flow.
- **Status:** ✅ Active
- **Routing chain:** Check Auth (chat_id allowlist) → Is /program? → Is /refresh? → Is /strikes? → Is /training? → Is Feedback? → drop

**Commands:**
| Command | Branch | What it does |
|---|---|---|
| `/program` | Ack Program → Call Planner (sub-workflow `lUcAtn2oxCPkNkJ1`) → Program Done | On-demand Sunday Planner run. Acks immediately, fires Sunday Planner via its `When Called` Execute Workflow Trigger; planner sends the plan itself, then "✅ Plan delivered." |
| `/refresh` | Call Backfill (sub-workflow `rHIyZMIJNAOqZvM2`) → Refresh Done | Last 7 days, idempotent re-analysis of unanalyzed sessions |
| `/strikes` | Get Strikes Sessions → Format Strikes → Send Strikes | Same Code aggregation as Weekly Stats workflow (`2W0SIHwzyAWJW62Q`) — 🔥 per hour + per-sport breakdown for the running week + 🦵 run cadence trend line (since 2026-07-12) |
| `/training` | Get Training Plan → Format Training → Send Training | `GET /weekly-plans?athlete_id=1&week_start_date=<this Monday>` then formats sessions JSON as Telegram message |
| `!<text>` | Save Feedback flow | Saves user feedback against the latest session (existing flow) |

- **Note:** This bot has the only active Telegram webhook on CroissantTri — adding more triggers on the same bot would conflict (Telegram allows 1 webhook per bot). Add new commands by extending this workflow's IF chain, not by creating new trigger workflows.
- **Command menu (added 2026-07-12):** the 4 slash commands are registered with Telegram via BotFather `/setcommands` (done manually — the bot token lives only in the n8n cloud credential, so it can't be automated from here). When adding/renaming a command, update BotFather too or the menu goes stale. `!feedback` is not a slash command and can't be listed.
- **Lessons baked into this design (from /refresh build, 2026-05-01):**
  - Avoid nested `splitInBatches` v3 — its loop-back wiring accumulates items across cycles when there are >1 inputs (the "triplet bug"). Use n8n's natural per-item cascade for inner iteration.
  - When using Execute Workflow + a follow-up Telegram message, set `alwaysOutputData: true` on the call node so the follow-up fires reliably even when the sub-workflow processed 0 items.
  - All Telegram replies should reference `$('Telegram Trigger').item.json.message.chat.id.toString()` for chat_id (not `$json.chat_id`), so they fire to the user who sent the command.

### 2. Coach Tri - Sunday Planner
- **ID:** lUcAtn2oxCPkNkJ1
- **Schedule:** Weekly on Sunday at 20:45 (Europe/Berlin) — intentionally after the 20:10 daily recap + 20:30 stats so the plan lands last; also on-demand via `/program` (Feedback Handler → `When Called` Execute Workflow Trigger)
- **Purpose:** Generate personalized weekly training plan for next week
- **Status:** ✅ Active
- **AI Model:** Claude Opus 4.7 (OpenRouter `anthropic/claude-opus-4.7`)

**Flow (live — Tricoach DB HTTP nodes, NOT the old Airtable export):**
1. `Search records` — `GET /athletes/1`
2. `Get Last Week Sessions` — `GET /sessions` for the last 4 weeks (`has_analysis=1`; CTL trend window — the running-week subset is the "last week" summary)
3. `Get Last Week Plan` — `GET /weekly-plans` for the running week (adherence comparison; `alwaysOutputData` so a missing plan doesn't kill the run)
4. `Get Wellness Week` (added 2026-07-12) — ICU `/wellness`, last 14 days (`alwaysOutputData`; array splits into ~14 items, fine since the next node runs once for all items)
5. `Build Prompt Context` (Code) — merges athlete + builds `lastWeekSummary`, `adherenceSummary` (planned blocks vs done — matched by `plan_session_id`, sport fallback for unmatched), `ctlLine` (CTL now vs ~4wk ago with direction), `wellnessLine` (avg sleep + HRV last 7d vs prior 7d + RHR), `racePrep` (empty until W≤2 — see race-week module below), AND computes **live periodization**: `weeks_to_race` from `Race Date`, derived `phase` (Base/Build/Peak/Taper/Race Week) and `weekly_hours_target` (ramps 6→8h, holds, then tapers). Overrides the stale static `Training Phase`.
6. `Basic LLM Chain` — Claude generates the plan from the athlete's DB `Goal`/`Training Principles`/`Constraints` + computed phase/volume + adherence + fitness trend + recovery
7. `Parse Json` (Set) → `Build Plan Telegram` (Code, appends `📈 CTL …` trend line + `🏁 Race plan` section when present) + `Create a record` (`POST /weekly-plans`)
8. `Send a text message` — Telegram

**Wired to** `errorWorkflow` (`psyVgPiGJoO5QOa4`) since 2026-07-12 (was the only Coach Tri workflow without it).

**Session schema (flex-pool, post-2026-06-06):** plan is a `sessions[]` array, each `{id, label, sport, duration_min, pinned_day, description}`. `pinned_day` is set ONLY when a constraint requires that day — currently **only the Wednesday Rapha ride**; everything else is `pinned_day: null`, a pickable pool. Telegram renders "📌 Pinned" + "🟦 Flex pool". No REST entries — rest = unused blocks.
**Labels:** KEY, OPTIONAL (Easy), OPTIONAL (Intensity).

**Planning intelligence (where each fact lives — "one home per fact"):**
- **Volume target** — computed in `Build Prompt Context`, enforced as a HARD rule in the prompt (sum of `duration_min` ≈ `weekly_hours_target` ±30min). Ramp 6→8h: Base weeks 6.0–7.5h, Build/Peak 8h, Taper 6.5→5h, Race Week 3.5h.
- **Periodization** — auto from `weeks_to_race` (no manual phase bumping); the DB `Training Phase` field is now vestigial/overridden.
- **Coaching rules** — live in the **DB athlete fields**, not the prompt: polarized 80/20, weekly bricks from Build, run cadence 175–180 spm, swim-as-priority, CSS descent (`Training Principles`); race targets + course implications (`Goal`); flex-pool scheduling + resource caps (`Constraints`).
- **Last-week adaptation** — Rule 7: C/F or low volume → trim; all A/B → hold/marginal increase; nothing logged → conservative. (One-week memory only, by design.)
- **Plan adherence (added 2026-06-10)** — Daily Checkin/Backfill persist `plan_session_id` on sessions (column + PATCH support added same day; the workflows had been sending it for weeks but the API silently dropped it). The planner compares the running week's plan blocks vs done sessions and feeds `adherenceSummary` to the prompt — Rule 7 extension: skipped KEY sessions (especially swim) carry over and are named in the focus line; repeated sport substitution → rebalance, not scold.
- **Fitness trend (added 2026-06-10)** — `ctlLine` from session `ctl` values (now vs ~4wk ago) goes to both the prompt (declining CTL → bias to consistency over intensity) and the Telegram message (`📈 CTL 18 (+0 vs 2wk ago — holding steady)`).
- **Recovery (added 2026-07-12)** — `wellnessLine` (Zepp sleep/HRV/RHR via ICU wellness) in the prompt; Rule 7 extension: avg sleep <6h or HRV declining week-over-week → cap intensity at max 1 intensity block, bias completable Z2.
- **Race-week module (added 2026-07-12)** — `racePrep` activates at `weeks_to_race ≤ 2`: W=2 → taper instructions (cut volume, race-pace touches, OW swims); W≤1 → race-week openers + a required extra output field `race_plan` (pacing from Goal targets + current FTP/CSS, transitions, nutrition, race-morning checklist) rendered as a `🏁 Race plan` Telegram section. Empty (verified) at W>2; W≤2 branch is logic-reviewed only — first real fire ~2026-08-30.

### 3. Coach Tri - Monthly Review
- **ID:** AA2oAY6ZPu5i1c7I
- **Schedule:** Sundays 19:30 (Europe/Berlin) with a `First Sunday?` gate (`$now.day <= 7`) — effectively first Sunday of each month; also on-demand via its `When Called` Execute Workflow Trigger (bypasses the gate)
- **Purpose:** Monthly zoom-out the daily/weekly messages don't give: 8-week volume table, CTL trajectory, run-cadence trend, grade distribution, swim frequency vs 2/wk, sleep/HRV month-over-month, per-discipline trajectory vs Erkner race targets, one focus for the next 4 weeks
- **Status:** ✅ Active (created 2026-07-12, verified live same day)
- **AI Model:** Claude Opus 4.7 (OpenRouter `anthropic/claude-opus-4.7`)
- **Flow:** Schedule Trigger → First Sunday? → `GET /athletes/1` → `GET /sessions` (56d, wrap=1) → `Get Wellness 8wk` (ICU, fullResponse) → `Build Review Context` (Code — aggregates everything into `reviewContext`) → LLM → Telegram (`📆 Monthly Review — <Month>`, plain text, ~12-16 lines)
- **Wired to** `errorWorkflow` (`psyVgPiGJoO5QOa4`)

---

## SQLite Schema (Tricoach DB)

See `./db/schema.sql` for the authoritative schema.

**Tables:** `athletes`, `weekly_plans`, `sessions` (reserved).

Columns are snake_case internally but the REST API response maps them to **Airtable-compatible field names** (e.g. `Name`, `Race Name`, `Training Phase`, `Monday`–`Sunday`). This lets existing n8n expressions (`$json['Training Phase']`, `$json['Monday']`, etc.) continue to work unchanged.

### API Endpoints

Base URL: `https://coach-db.arthurpfz.com`
Auth: `X-API-Key` header (stored in VPS `.env` and n8n credential `6GNzKYNE1JAz77RL`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | ping |
| GET | `/athletes` | list all (used by Daily Checkin loop) |
| GET | `/athletes/:id` | one athlete (used by Sunday Planner) |
| PUT | `/athletes/:id` | update fields (last_coaching_date, Strava tokens) |
| GET | `/weekly-plans?athlete_id=&week_start_date=` | Search Plan for a specific week |
| GET | `/weekly-plans/latest?athlete_id=` | most recent plan |
| POST | `/weekly-plans` | upsert plan (Sunday Planner create) |
| DELETE | `/weekly-plans/:id` | delete a plan row (added 2026-06-10) |
| GET | `/sessions?athlete_id=&limit=&date_from=&date_to=` | list sessions (`date_to` supported since 2026-06-10; `limit` clamped 1–1000) |
| POST | `/sessions` | upsert session on `(athlete_id, intervals_id)`, returns `{id, analyzed_at}`, preserves LLM/user fields on re-upsert |
| PATCH | `/sessions/:id` | attach `analysis`, `analyzed_at`, `grade`, `plan_session_id`, `rpe`, `notes` (Daily Checkin Save Analysis) |

**`POST /sessions` upsert semantics (since 2026-05-01):**
The `PRESERVE_ON_UPSERT` set in `server.js` excludes `analysis`, `analyzed_at`, `grade`, `rpe`, `notes`, `user_feedback`, `user_feedback_at` from the `ON CONFLICT DO UPDATE` clause. Re-saving an existing activity refreshes the raw FIT metrics but does NOT clobber LLM analysis or user feedback. This is what makes `/refresh` idempotent — Backfill calls Save Session every time, but already-analyzed sessions retain `analyzed_at` and short-circuit downstream.

**Current athlete (id=1):** Arthur Pfalzgraf
- Intervals.icu Athlete ID: `i492254`
- Intervals.icu API Key: stored in `.env` as `INTERVALS_API_KEY` (and in n8n credential `ms91wbaCvecB3tqQ`)

### Migration

One-time migration from Airtable base `appw0Xd3T54okfaXa` lives at `./db/migrate.js`. Run on VPS with:

```bash
cd /data/tricoach-db
docker compose exec -e AIRTABLE_PAT=... tricoach-db node migrate.js
```

Initial migration (2026-04-22): 1 athlete + 16 weekly plans migrated cleanly.

### Relay Operations

Via CroissantRelayBot on Telegram or the webhook:
- `tricoach-db-status` — container state + last 20 log lines
- `tricoach-db-logs` — last 50 log lines
- `tricoach-db-restart` — `docker compose restart`

---

## Intervals.icu Integration

### API Configuration
- **Base URL:** https://intervals.icu/api/v1
- **Authentication:** HTTP Basic Auth
  - Username: `API_KEY` (literal string)
  - Password: User's personal API key
- **Credential ID:** ms91wbaCvecB3tqQ
- **API Endpoint Examples:**
  - Get Activities: `/athlete/{athleteId}/activities`
  - Get Activity Details: `/activity/{activityId}`

### Activity Fetching
- **Endpoint:** `/athlete/{athleteId}/activities`
- **Parameters:**
  - `oldest`: Today's date (yyyy-MM-dd format)
  - `newest`: Today's date (yyyy-MM-dd format)
- **Returns:** Array of activities uploaded today
- **Important:** Only returns activities from direct device uploads (not Strava-sourced)

### Data Available
Full FIT file metrics including:
- Power metrics (avg, normalized, max, VI)
- Heart rate (avg, max, LTHR, zone distribution, time in zones)
- Cadence (run and bike)
- Pace and speed
- Training load (TSS, intensity factor, TRIMP)
- Interval structure (auto-detected from activity)
- Stream types available (watts, heartrate, cadence, etc.)
- Device information

### Known Limitations
- **Strava-sourced activities are blocked** via API
- Activities must come from direct uploads (Zwift, COROS, Wahoo, Garmin)
- If Strava is connected to Intervals.icu, those activities won't be accessible via API
- Solution: Disconnect Strava, use direct device connections

---

## Strava Integration — DEPRECATED 2026-06-06

Workflow `Q2KE0XGsc8NWLY8V` deleted. OAuth tokens and DB columns retained but unused.

**Future option (not built):** Strava's official MCP launches 2026-06-01 (included with subscription). Could plug in as an interactive Telegram layer for ad-hoc questions about historical Strava activities — Intervals.icu remains the source of truth for the automated daily/weekly pipeline.

---

## Session Structure

### Session Labels

**KEY:**
- Priority session - do not skip
- Contains structured workout
- Includes warm-up, main set, cool-down
- Specific targets (HR/pace/power)

**OPTIONAL (Easy):**
- Can skip freely
- Zone 2 only, no exceptions
- 30-50 minutes
- Conversational pace

**OPTIONAL (Intensity):**
- Can skip if needed
- Short intervals allowed
- 30-40 minutes max
- Max 1 per week
- Never scheduled day before KEY session

**REST:**
- No training

### Example Session Formats

```
KEY: Swim: 55min. WU: 10min easy. MS: 6x200m @ CSS (2:05/100m) w/ 30s rest. CD: 5min easy.

KEY: Bike: 60min Zwift. WU: 15min Z2. MS: 4x8min sweet spot (235-248W) w/ 3min recovery. CD: 10min easy.

OPTIONAL (Easy): Run: 40min Zone 2 (114-149bpm) treadmill. Relaxed form, conversational pace.

OPTIONAL (Intensity): Run: 35min. WU: 15min Z2. MS: 6x30s strides w/ 90s recovery. CD: 10min easy.

REST
```

---

## AI Coaching Logic

### Daily Check-In Analysis (Claude Sonnet 4.6, post-2026-05-10)

**Context Provided:**
- Athlete profile (phase + fitness profile: HR zones, FTP, CSS, cadence targets)
- This week's plan (indicative, not graded against)
- Already-matched sessions this week (for plan_session_id deduplication only)
- Today's activity with full FIT metrics from Intervals.icu (power, HR + zones, cadence, pace, TSS, IF, intervals)

**Analysis Logic:**

The session is judged purely on **execution quality vs the athlete's fitness profile**. The weekly plan is shown to the LLM as soft context but is NOT used as a benchmark. See [feedback_no_plan_grading.md](../../../../.claude/projects/-Users-arthurpfalzgraf-Desktop-Projects-TRI-COACH/memory/feedback_no_plan_grading.md).

1. **Session quality grade (A/B/C/F)** — clean zone work, pacing, cadence, decoupling, drift
2. **Two technical insights** — specific numbers from the FIT data
3. **Limiter** — the one thing holding back progress (mechanical, aerobic, fueling, etc.)
4. **Tomorrow** — forward guidance, ≤12 words
5. **Watch** — one metric to track next time, ≤8 words
6. **Plan matching for tracking only** — `plan_session_id` is set when today corresponds to an unmatched session of the same sport. Otherwise null. This affects the DB record, NOT the message tone or grade.

**Off-plan handling:** there isn't any. An unplanned long Z2 ride that holds zones cleanly is an A. Don't prefix messages with "⚠️ Off-plan", don't moralize about deviation, don't scold. The plan is indicative.

**Output Requirements:**
- Telegram-native bullets, plain text, ~6-8 lines (see Output Style above)
- JSON wrapper: `{"plan_session_id":"...","grade":"A|B|C|F","message":"..."}`
- Parse Grade node extracts `grade` and `message` from the JSON before Save Analysis + Send Telegram

### Weekly Planning (Claude Opus 4.7)

**Context Provided:**
- Athlete profile (name, race, race date)
- Current training phase
- Fitness profile (exact HR zones, paces, power, CSS)
- Personal constraints

**Planning Rules:**

1. **Constraints are non-negotiable** - if constraints conflict with best practices, constraints win
2. **Label every session** with exactly one of: KEY, OPTIONAL (Easy), OPTIONAL (Intensity), REST
3. **Optional session rules:**
   - Max 1x OPTIONAL (Intensity) per week
   - OPTIONAL (Intensity) never day before KEY session
   - OPTIONAL (Easy) is always Zone 2, no exceptions
4. **Phase-appropriate focus:**
   - Base 1-2: Aerobic endurance, consistency, technique (80-90% Zone 2)
   - Build 1-2: Introduce intensity, sport-specific work (70-80% Zone 2)
   - Peak: Race simulation, sharpening
   - Taper: Reduce volume, maintain some intensity
5. **Use exact values from Fitness Profile** - HR zones, paces, power, CSS
6. **Session structure:**
   - KEY: Warm-up + main set with specific targets + cool-down
   - OPTIONAL: Simple structure, clear intensity guidance
   - Always specify: duration, intensity, focus

**Output Format:** JSON only, no markdown

---

## Current Configuration

### Schedule Times (Europe/Berlin)
- **Daily Check-in:** 20:10 (8:10 PM)
- **Weekly Stats:** 20:30 (8:30 PM)
- **Weekly Planning:** Sunday 20:45 (8:45 PM)
- **Monthly Review:** first Sunday of month 19:30 (7:30 PM)

### Credentials Used
- Tricoach DB (ID: 6GNzKYNE1JAz77RL, httpHeaderAuth with `X-API-Key`)
- ~~Airtable Personal Access Token (ID: JMbdFoTWoGU3avK9)~~ — deprecated 2026-04-22
- OpenRouter API (ID: nhbNqmgyP4cAeQ6B)
- Telegram API (ID: 9IpAp35yJmIQJpeA)
- Intervals.icu HTTP Basic Auth (ID: ms91wbaCvecB3tqQ)

### Active User
- **Name:** Arthur Pfalzgraf
- **Telegram Chat ID:** see `.env` (`TELEGRAM_CHAT_ID`)

---

## Known Limitations & Future Improvements

### Multi-User Support
- Daily Check-in: ✅ Loops through all users
- Sunday Planner: ❌ Hardcoded to "Arthur Pfalzgraf"
- **Action:** Remove filter or loop through all users for scalability

### Error Handling
- No error notifications if APIs fail
- **Action:** Add error handling nodes with Telegram alerts

### Activity Sync Optimization
- "Last Activity Sync" field is set but never read
- **Action:** Use timestamp to avoid re-fetching same activities

### Intelligent Planning Evolution
- Currently doesn't consider last week's execution
- **Action:** Factor in adherence rate, fatigue indicators (HRV, TSS), progressive overload

### Two-Way Communication
- Currently one-way (system → athlete)
- **Action:** Allow athlete to respond via Telegram, adjust plan based on feedback

### Workout Library
- Regenerates workouts each week
- **Action:** Create reusable workout templates in Airtable, reference by ID

### Security
- Strava client secret exposed in workflow definition
- **Action:** Move to N8N credentials vault

---

## Local Development Setup

### N8N API Client (Node.js)
- **Location:** `/Users/arthurpfalzgraf/Documents/TRI COACH/`
- **Files:**
  - `n8n-client.js` - Main API client class
  - `test-connection.js` - Connection test script
  - `examples.js` - Usage examples
  - `.env` - Environment configuration (API key stored here)

### Available Methods
```javascript
const client = new N8NClient();

await client.getWorkflows()                    // List all workflows
await client.getWorkflow(workflowId)            // Get specific workflow
await client.createWorkflow(workflowData)       // Create new workflow
await client.updateWorkflow(id, data)           // Update workflow
await client.deleteWorkflow(workflowId)         // Delete workflow
await client.activateWorkflow(workflowId)       // Activate workflow
await client.deactivateWorkflow(workflowId)     // Deactivate workflow
await client.executeWorkflow(id, data)          // Execute workflow
await client.getExecutions(workflowId, limit)   // Get executions
```

### Running Tests
```bash
npm test             # Test N8N connection
npm run examples     # Run example operations
```

### Diagnostic Scripts
```bash
# Check recent workflow executions
node check-executions.js

# Get detailed execution debug info
node debug-execution.js

# Compare draft vs active workflow versions
node check-versions.js

# Analyze workflow structure
node analyze-workflows.js
```

---

## Project Philosophy

### Coaching Principles
1. **Flexibility Over Rigidity:** Life happens - KEY vs OPTIONAL framework allows adaptation
2. **Constraints First:** Respect personal limitations (work, family, recovery needs)
3. **Phase-Based Training:** Progressive periodization from Base → Build → Peak → Taper
4. **Data-Driven Feedback:** Use actual metrics (HR, pace, power) not just "felt good"
5. **Supportive Accountability:** Daily check-ins without guilt or pressure

### System Design Principles
1. **Automation First:** Minimize manual intervention
2. **Single Source of Truth:** Tricoach DB (self-hosted SQLite) as central database
3. **AI as Coach:** Claude handles reasoning and communication nuance
4. **Clean Separation:** Planning (Sunday) vs Execution Tracking (Daily)
5. **Fail Gracefully:** Always output data even if APIs fail

---

## Troubleshooting

### Common Issues

#### 1. Daily Check-in Failing with 401 Strava Authorization Error

**Symptoms:**
- Workflow executions show "Authorization failed - please check your credentials"
- Error occurs at "Get Activities" node
- Error message: `{"message":"Authorization Error","errors":[{"resource":"Athlete","field":"access_token","code":"invalid"}]}`

**Root Cause:**
The "Get Activities" node was using an expired/invalid Strava access token from Airtable instead of the freshly refreshed token.

**Diagnosis:**
```bash
# Check recent executions
node check-executions.js

# Get detailed execution error
node debug-execution.js

# Check workflow versions
node check-versions.js
```

**The Problem:**
- Workflow refreshes Strava token via "HTTP Request" node
- New token is saved to Airtable via "Update record" node
- BUT "Get Activities" node was referencing the OLD token from "Loop Over Items"
- This caused 401 errors because the token was expired

**The Fix:**
Change the "Get Activities" node Authorization header from:
```
Bearer {{ $('Loop Over Items').item.json['Strava Access Token'] }}  // ❌ Expired
```

To:
```
Bearer {{ $('HTTP Request').item.json.access_token }}  // ✅ Fresh
```

**How to Apply:**
1. Open workflow in N8N UI
2. Click on "Get Activities" node
3. Go to Headers section
4. Update Authorization header value
5. Click Save to publish the draft

**Important:** N8N has **draft** and **active** versions. Changes must be saved/published to take effect in production.

#### 2. Workflow Versioning in N8N

N8N Cloud workflows have two versions:
- **Draft Version:** Your current working copy (can be edited)
- **Active Version:** The version currently executing on schedule

**Key Points:**
- Changes to workflow only affect the draft
- Draft must be **saved/published** to become active
- N8N API does not allow programmatic PATCH/POST updates (methods return 405)
- All workflow updates must be done through the N8N web UI

**Checking Version Status:**
```bash
node check-versions.js
```

This will show:
- Current draft version ID
- Active version ID
- Whether they match (✅ or ❌)
- Authorization headers in both versions

**If versions don't match:**
1. Go to workflow in N8N UI
2. Click "Save" button
3. This publishes the draft as the new active version

---

## Changelog

### 2026-07-12 (night) — Full e2e verification pass + rest-day branch fix
- **BUG (pre-existing, found during e2e): rest-day Telegram never fired.** When Intervals.icu returned 0 activities (or ZEPP-only, filtered out), the chain died silently at `Get Activities`/`Filter Activities` — 0 items means downstream nodes never run, so `Check Activities Exist → false → Send Rest-Day Telegram` was structurally unreachable. **Fix (Daily Checkin only):** `alwaysOutputData: true` on `Get Activities` + `Filter Activities`, and `Check Activities Exist` leftValue changed to `$input.all().filter(i => i.json && i.json.id).length` so the empty passthrough item doesn't count as an activity. Verified live: 0-activity day now sends 🛌. Backfill intentionally untouched (no rest-day branch; 0 items = correctly silent).
- **E2e matrix, all live:** Daily Checkin (temp trigger → gate passed, date updated, rest-day fired); Backfill (re-analysis of Jul 7 run — readiness in prompt + Tomorrow line, `detected_test` null path); test-detection **positive** path (temp harness with byte-identical node copies + no-op FTP 261 → parse → IF true → regex → PUT 200 → Telegram note; athlete fields byte-identical after); Sunday Planner (wellness line + adherence + racePrep empty at W=9, plan row saved); Weekly Stats (cadence line + week totals); Monthly Review (full run → Telegram). Feedback Handler `/strikes` runs the same code as Weekly Stats' verified `Format Stats` — Telegram trigger rejects synthetic posts, so live confirmation = Arthur sends `/strikes` once.
- `last_coaching_date` reset to 2026-07-11 after tests so the 20:10 cron runs normally tonight. All temp workflows/triggers deleted; verified zero leftovers, all 7 workflows active with errorWorkflow set.

### 2026-07-12 (evening) — Wellness/readiness, auto test detection, cadence trend, race-week module, Monthly Review
Five features shipped in one pass (all deployed via `PUT /workflows`, all verified live same day):
- **Readiness in daily analysis (Daily Checkin `hrSGUqoAwkWQ4gKl` + Backfill `rHIyZMIJNAOqZvM2`):** new `Get Wellness` (ICU `/wellness`, 7d window ending on session date, `fullResponse+neverError`) + `Build Readiness` nodes feed sleep/HRV/RHR vs 7d baselines into the prompt. Readiness colors tone + Tomorrow line only — never the grade. Verified live: re-analyzed the Jul 7 run via Backfill; LLM output "Tomorrow: Easy Z2 ride or full rest — HRV 55 vs 88 avg."
- **Auto test detection → profile update (same two workflows):** prompt `TEST DETECTION` section emits `detected_test` (400m swim TT → CSS; 20min max bike → FTP = 0.95×power; all-out 5K → run threshold; null when in doubt). New branch `Has Test? → Apply Test Update → PUT /athletes/:id → Send Test Update` regex-replaces the value across the 4 free-text athlete fields + Telegram notice. Regexes tested against live field text (percentages + race targets untouched). Verified: normal run → `detected_test` empty, branch skipped.
- **FTP normalized to 261W** across `fitness_profile`/`goal`/`constraints`/`health_status` (was inconsistent 276 vs 261; user chose 261 — "(retest due)" dropped, auto-update owns freshness now).
- **Run cadence trend (Weekly Stats `2W0SIHwzyAWJW62Q` + `/strikes` in `gAnJ0r3x0sFxqWxY`):** session fetch widened to 56d/limit 300, week totals filtered client-side, new `🦵 Run cadence 149 spm (-1 vs prior month · target 175-180)` line — duration-weighted, runs ≥10min, 28d vs prior 28d, **avg_cadence×2 (stored half-spm for runs)**. Verified live via temp trigger.
- **Sunday Planner (`lUcAtn2oxCPkNkJ1`):** new `Get Wellness Week` (14d) → `wellnessLine` + RECOVERY prompt block + Rule 7 extension (short sleep/declining HRV → cap intensity); race-week module (`racePrep`: taper at W=2, race week + `race_plan` output field at W≤1, `🏁 Race plan` Telegram section); `errorWorkflow` finally set. Verified live: plan for Jul 13 generated with focus line reacting to "Sleep 6h28, HRV declining"; racePrep correctly empty at W=9. W≤2 branch first fires ~2026-08-30 — watch it.
- **NEW WORKFLOW: Coach Tri - Monthly Review (`AA2oAY6ZPu5i1c7I`)** — first Sunday of month 19:30 (day≤7 gate), 8-week zoom-out (volume table, CTL, cadence, grades, swim frequency, sleep/HRV month-over-month, trajectory vs race targets) via Opus 4.7 → Telegram. Has `When Called` trigger for manual runs (bypasses gate). Verified live end-to-end; next natural fire Aug 2.
- **Verification technique:** temp webhook bridge workflow (created, repointed per target via PUT, deleted after) + temp `When Called` trigger on Weekly Stats (removed after). Execution node outputs inspected via `GET /executions/:id?includeData=true`.
- **Corrected stale doc fact:** live Intervals.icu basic-auth credential is `ms91wbaCvecB3tqQ` (docs previously said JBZzr0E5U1GSy6OQ).

### 2026-07-12 (later) — Multi-session days: all sessions now analyzed, graded as a day
- **BUG: only one session per day ever analyzed** — user had to `/refresh` (sometimes repeatedly) to get the rest. TWO root causes:
  1. Daily Checkin (`hrSGUqoAwkWQ4gKl`) still had the nested `Loop Over Activities` splitInBatches with loop-back wiring — the same "triplet bug" pattern removed from Backfill in May. **Fix:** node deleted, `Check Activities Exist → Get Activity Details` direct per-item cascade (mirrors Backfill), `Get Activity Details` URL now `{{ $json.id }}`.
  2. **The deeper one, in BOTH workflows:** `Build Trend Stats` + `Build Sport Metrics` Code nodes ran in default `runOnceForAllItems` mode with `.first()` refs and single-item returns — N items in, 1 item out. Everything downstream (streams, LLM, Telegram) ran once regardless of session count. **Fix:** both switched to `runOnceForEachItem` with `.item` pairing. Also `Get Activity Streams` now uses `fullResponse + neverError` so array/empty responses can't split or drop items (a swim's empty torque response previously vanished from the batch on mixed days).
- **Same-day context + fair grading for short sessions** (`Hardcore Analysis` prompt, both workflows):
  - New `OTHER SESSIONS TODAY` section — lists the day's other DB sessions (sport · min · km · grade). `Get Matched Sessions` dropped `has_analysis=1` so just-saved same-run sessions appear (ALREADY MATCHED behavior unchanged — it filters on `plan_session_id`).
  - New `MULTI-SESSION DAYS & SHORT SESSIONS` rules: judge a session as part of the day's whole (short pool + open-water = good swim day), NEVER fail for brevity, short swims (<15min) grade neutrally.
- **Sport normalization in trend/metrics:** `normSport()` in both Code nodes — OpenWaterSwim now gets Swim-family trend stats (7 sessions vs OWS-only before) and swim form metrics.
- **Verified e2e** via temp webhook bridge (deleted after): nulled the Jul 9 pool+OWS pair → one Backfill run analyzed BOTH (2 items through every node, 2 Telegrams), each prompt showed the other session, pool regraded C→B, Jul 11 9-min OWS regraded F→B. Daily Checkin restructure is wiring-identical to Backfill; first live run = tonight's 20:10 cron (error handler alerts if it fails).

### 2026-07-12 — Open-water swims missing from per-sport volume breakdown
- **BUG:** Weekly Stats (`2W0SIHwzyAWJW62Q` `Format Stats`) and `/strikes` (`gAnJ0r3x0sFxqWxY` `Format Strikes`) bucketed minutes into `Run/Swim/Ride/Workout` by exact sport-name match, special-casing only `VirtualRide → Ride`. Intervals.icu labels open water as `OpenWaterSwim`, which ≠ `Swim`, so those minutes never landed on the 🏊 Swim row (they still counted in the total 🔥 hours). Arthur flagged open water "not counted as training." Daily Checkin was unaffected — every `OpenWaterSwim` was saved, analyzed, and graded.
- **Fix:** replaced exact-match with a substring normalizer in both nodes — `swim`→Swim, `run`→Run (checked before ride so VirtualRun works), `ride|bike|cycl|virtual`→Ride, else Workout. Deployed via `PUT /workflows`, both HTTP 200 + active.
- **Verified** against live sessions (week of 2026-07-06): 🏊 Swim 0:43 → 2:56 (5 open-water swims, +2:13 previously invisible). Confirmed live end-to-end via `/strikes` on Telegram same day.
- **Sunday Planner too:** `Build Prompt Context` (`lUcAtn2oxCPkNkJ1`) adherence sport-fallback had the same exact-match gap — added a `normSport()` helper so `OpenWaterSwim` matches a planned `Swim` (and `VirtualRide`/`bike` a `Ride`) when `plan_session_id` is null. Deployed HTTP 200 + active; verified on live week 2026-07-06 data (no regression — this week's swims already matched via persisted `plan_session_id`; the fix covers the null-`plan_session_id` fallback).

### 2026-06-29 (later) — Sunday Planner moved to 20:45 (plan lands last)
- The new weekly plan fired at 20:05, *before* the 20:10 daily recap — odd ordering. Moved Sunday Planner (`lUcAtn2oxCPkNkJ1`) schedule trigger to **20:45**, so the Sunday sequence is daily recap (20:10) → weekly stats (20:30) → next week's plan (20:45). Only the cron minute changed; the `/program` on-demand path is untouched. Deployed via `PUT /workflows`, confirmed active.

### 2026-06-29 — Short swims no longer dropped by the 10-min filter
- **BUG:** Arthur's June 28 open-water swim (mid-ride, COROS, **568s moving / 429m**) was never analyzed or sent. Root cause: `Filter Activities` `moving_time >= 600` floor (a false-start guard) dropped it — 32s under cutoff. Both Daily Checkin and `/refresh` skipped it silently; it had synced to Intervals.icu fine.
- **Fix:** `drop-short` condition in `Filter Activities` rewritten to a boolean expr exempting swims — `(type contains "swim") || moving_time >= 600` — in both Daily Checkin (`hrSGUqoAwkWQ4gKl`) and Backfill (`rHIyZMIJNAOqZvM2`). Ride/run still held to the 10-min floor. Deployed via `PUT /workflows`, both confirmed `active`.
- **Verified end-to-end:** temp webhook→Execute Workflow bridge triggered Backfill; swim now passes the filter → saved (session id 370, OpenWaterSwim) → analyzed (Grade B, "too short + no HR" honest call) → Telegram sent with 📅 prefix. Temp bridge deleted after.

### 2026-06-10 (evening) — Plan adherence loop + CTL trend in Sunday Planner
- **BUG FIX (data layer):** Daily Checkin/Backfill `Save Analysis` had been PATCHing `plan_session_id` for weeks, but `db/server.js` had no such column and it wasn't in `PATCH_FIELDS` — silently dropped. Added column (auto-migrated) + PATCH support. Also: `date_to` filter on `GET /sessions` (the planner was already sending it — silently ignored), `DELETE /weekly-plans/:id`, and removed a leftover test plan row (`week 2099-01-01`) that broke `/weekly-plans/latest`. Deployed via PR #7 + `tricoach-db-deploy-raw`.
- **Sunday Planner (`lUcAtn2oxCPkNkJ1`):** new `Get Last Week Plan` node; `Get Last Week Sessions` widened to a 4-week window (CTL trend); `Build Prompt Context` builds `adherenceSummary` (planned blocks vs done, `plan_session_id` match with sport fallback) + `ctlLine`; prompt gains ADHERENCE + FITNESS TREND blocks and Rule 7 extensions (skipped KEY carries over, declining CTL → consistency over intensity); `Build Plan Telegram` appends `📈 CTL …`.
- **Verified end-to-end** via temp webhook bridge (deleted after): adherence showed `rapha-ride: DONE · Grade B` via persisted plan_session_id, LLM named the carry-over in the focus line, Telegram included the CTL line, plan row for 2026-06-15 saved. Note: the test ran Wednesday so adherence saw a partial week — Sunday's cron run is the first full-data run.
- Update script archived at [update-planner-adherence.js](archive/update-planner-adherence.js); `workflow-sunday-planner.json` re-exported.

### 2026-06-10 (later) — Swim analysis silent failure + Rapha ride intent grading
- **BUG (since Phase 5, 2026-05-11): swims never analyzed.** `Get Activity Streams` returns an empty array for swims (no torque stream) → 0 items → branch dies silently, n8n still reports "success". Sessions saved but `analyzed_at` stayed null (May 18 + June 9 swims affected; rides/runs unaffected). **Fix:** `alwaysOutputData: true` on `Get Activity Streams` in Daily Checkin (`hrSGUqoAwkWQ4gKl`) + Backfill (`rHIyZMIJNAOqZvM2`) — `Build Sport Metrics` already guards empty input. June 9 swim re-analyzed via Backfill (Grade B, delivered). May 18 swim left unanalyzed (outside 7-day window, stale).
- **Rapha ride intent grading.** The June 10 Wednesday Rapha ride was graded C as a "failed Z2" — sprints flagged as zone leakage, torque CV/cadence as mechanical faults. Arthur: Rapha = Z2 base + deliberate sprints in the middle. **Fix in `Hardcore Analysis` prompt (both workflows):**
  - New `Date (weekday):` line in the activity block (Luxon `toFormat('cccc, yyyy-MM-dd')`) — the LLM can't derive weekday from a date.
  - New `SESSION INTENT` section with a **hard Wednesday-ride rule**: Z4/Z5 spikes = designed sprint block (never leakage); torque CV/VI/avg cadence EXCLUDED from grading (group dynamics distort them); grade on Z2 base discipline + effort commitment + HR recovery. Generic surge-pattern rule for other group rides.
  - Lesson: a soft "infer intent" rule did NOT change the output — the rule had to be imperative before the model stopped penalizing sprints. Verified by re-running the same session: C → C → **B "Clean Rapha execution"**.
- **Re-analysis technique:** PATCH session `analysis/analyzed_at/grade` to null, then trigger Backfill via a temporary webhook→Execute Workflow bridge (Telegram trigger rejects synthetic posts with 403 — secret token). Temp workflow deleted after use.
- Memory: [feedback_rapha_ride_intent.md](../../../.claude/projects/-Users-arthurpfalzgraf-Desktop-Projects-TRI-COACH/memory/feedback_rapha_ride_intent.md).

### 2026-06-10 — Audit cleanup: doc/live sync, DB hardening, repo archive
- **Docs synced to live n8n state:** check-ins/backfill run Claude Sonnet 4.6 (`anthropic/claude-sonnet-4.6`), Sunday Planner runs Claude Opus 4.7 (`anthropic/claude-opus-4.7`); schedule times corrected (Daily 20:10, Stats 20:30, Planner Sun 20:05).
- **`db/server.js` hardening:** startup fails if `API_KEY` unset (was: silently unauthenticated); `?limit` clamped to 1–1000; POST/PATCH `/sessions` errors logged server-side, generic message returned (no more raw SQLite errors to clients). Rebuilt + redeployed on VPS.
- **Repo hygiene:** one-off scripts and dead status docs moved to `archive/`; `workflow-daily-checkin.json` re-exported from live; `.claude/` + `.DS_Store` gitignored.

### 2026-06-06 (later) — Erkner 70.3 objective: flex-pool + auto-periodization + 6–8h volume target
- **Goal:** 14 weeks out from Erkner 70.3 (2026-09-13), target 6–8h/week, ramping from a ~3h/week actual base. Athlete data showed two flags: run cadence stuck ~150 spm (target 175–180) and an under-trained swim.
- **Sunday Planner (`lUcAtn2oxCPkNkJ1`):**
  - `Build Prompt Context` Code node now computes **live periodization** from `Race Date`: `weeks_to_race`, derived `phase`, and `weekly_hours_target` (ramp 6→8h over Base weeks, hold 8h Build/Peak, taper 6.5→5→3.5h). Overrides the stale static `Training Phase`.
  - Prompt: profile line now shows phase | weeks-to-race | volume target; the old "generate 6–9 sessions" rule replaced with a **HARD volume rule** (sum of `duration_min` ≈ target ±30min) + "only Rapha pinned (Wed), all else `pinned_day: null`".
- **DB athlete record (`PUT /athletes/1`):**
  - `Constraints` rewritten to a **flex-pool model** — all day restrictions removed (no fixed KEY days, no Mon/Sun rest rules, no Fri-eve block, no weekday/weekend duration caps). Only Wednesday Rapha stays pinned. Durations now sized by session type. Resource caps kept (pool/treadmill, max 2 runs & 2 swims/wk).
  - `Training Principles`: removed the Tue/Wed/Fri-KEY-day line and the Sat-pinned long-ride line (now "any day"). Polarized 80/20, weekly bricks from Build, cadence 175–180, swim priority all retained — these already drive the prompt, so no prompt duplication.
- **Weekly Stats (`2W0SIHwzyAWJW62Q`):** `Format Stats` appends a day-aware 6–8h volume nudge (see workflow 1d).
- **Deploy:** all via REST API (`PUT /athletes/1`, `PUT /workflows/{id}` ×2) — HTTP 200 each, both workflows confirmed `active`.
- **Verified:** DB rewrite + deployed node content via GET; periodization formula via node; **Weekly Stats nudge end-to-end** against live sessions (rendered `⚡ 4.4h to go for your 6h floor — 1 day left.`). NOT verifiable from CLI: the Planner's live LLM output — local `OPENROUTER_API_KEY` is dead (401) and the n8n public API can't trigger runs (405). Exercised by the next Sunday cron or a `/program`.
- **Files:** CLAUDE.md (this entry + Planner/Weekly-Stats sections); `workflow-sunday-planner.json` re-exported from live (was a stale Airtable export).
- **Follow-up (same day):** swim sessions simplified per athlete feedback — `Training Principles` swim block rewritten to "keep it simple" (building warm-up → one main set at race pace, default 8x150 @ 1:58/15s → short cool-down; no drill alphabet; 400m TT every 4-6 weeks as the only test) and the prompt's swim example updated to match. See memory `feedback_simple_sessions.md`.

### 2026-06-06 — Strava deprecation (legacy workflow deleted)
- **Trigger:** Strava Developer Program update (effective 2026-06-30) requires a Strava subscription for Standard Tier API access; 2027 introduces base URL migration to `api-v3.strava.com`.
- **Action:** Deleted n8n workflow `Q2KE0XGsc8NWLY8V` ([ARCHIVED] Coach Tri - Daily Checkin Strava). It had been inactive since Intervals.icu became primary in Jan 2026.
- **Kept dormant:** athlete columns `strava_access_token`, `strava_refresh_token`, `strava_id`; `sessions.source='strava'` value. No migration — schema cost is zero.
- **Cleaned:** removed Strava section from CLAUDE.md, dropped Strava IDs from Quick Reference, retagged Error Handler "Wired to" line.
- **Not built:** Strava's official MCP (launches 2026-06-01, included with subscription) could later be an interactive Telegram layer for historical Strava queries — Intervals.icu remains source of truth for the automated pipeline.

### 2026-05-11 — Phase 5: Sport-specific form metrics
- **Two new nodes** added to Daily Checkin (`hrSGUqoAwkWQ4gKl`) and Backfill (`rHIyZMIJNAOqZvM2`):
  - **Get Activity Streams** — HTTP GET `https://intervals.icu/api/v1/activity/{id}/streams?types=torque`. Tolerates errors (`onError: continueRegularOutput`) so non-cycling sports don't break the flow.
  - **Build Sport Metrics** — Code node, sport-aware. Outputs `sportMetrics` string consumed by the prompt:
    - **Run**: cadence (×2 → spm), stride length, pace, sport-science targets (170-180 spm, 0.85-1.10m stride at Z2). Explicit note that Running Dynamics (GCT, oscillation, vertical ratio) are NOT available on COROS PACE 3 wrist-only.
    - **Swim**: stroke rate, distance per stroke, pool dimensions, **computed SWOLF** = seconds per length + strokes per length (derived from moving_time, lengths, SR). Targets: SWOLF <38 strong, DPS 1.4-1.8m freestyle.
    - **Ride**: `icu_cadence_z2`, `polarization_index`, anaerobic kJ above FTP, **torque variability CV** computed from the per-second torque stream. Explicit note that L/R balance + pedaling smoothness % NOT available — SRAM Apex AXS is a single-sided crank-arm meter.
- **Hardware gap documented in the prompt itself** so the LLM cannot hallucinate metrics we don't have. To unlock fuller form coaching, hardware upgrade paths:
  - Running Dynamics → COROS POD 2 (~€150) or Stryd (~€220)
  - True L/R balance + pedaling smoothness → dual-sided meter (Favero Assioma DUO ~€650, Garmin Rally)
- **Prompt size:** 9453 → 10693 chars. Still within Sonnet 4.6 budget.
- **Form coaching rules** added: cadence prescriptions when <165 spm, stroke-economy push when SWOLF >40, pedaling consistency comment when torque CV >0.40. Honest "do NOT invent missing metrics" rule.
- **Files touched:** [phase5-sport-metrics.js](archive/phase5-sport-metrics.js), CLAUDE.md.

### 2026-05-10 (later) — 30-day trends + weather/elevation context + garbage filter
- **30-day trend context** added to Daily Checkin (`hrSGUqoAwkWQ4gKl`) and Backfill (`rHIyZMIJNAOqZvM2`).
  - Two new nodes: `Get Trend Sessions` (HTTP GET `/sessions?date_from=today-30d&has_analysis=1&wrap=1`) and `Build Trend Stats` (Code node — filters by current sport, computes count, avg duration/distance/TSS/HR/power/decoupling/EF, longest session, grade distribution).
  - Inserted between `Get Matched Sessions → Hardcore Analysis`. Outputs `trendSummary` string consumed by the prompt as `{{ $json.trendSummary }}`.
  - Sport filter happens client-side in Build Trend Stats (kept Tricoach DB API unchanged — `?sport=` not added).
- **Weather + elevation in prompt** — `total_elevation_gain`, `average_temp`, `average_wind_speed` (with optional headwind%) now expressed in the metrics block. Prompt rules updated with "CONDITIONS-AWARE FLAGGING" section: low cadence on a ride with >500m climbing is *expected*, HR drift at >28°C is *expected*, etc. Stops the bot from flagging environmental noise as athlete failures.
- **Trend usage rule** — "Use trend deltas for color when meaningful (>5% or notable). Don't force mentions. Trend is color, not currency — does NOT change the grade rubric."
- **Filter Activities — added `distance > 0`** to both workflows. Catches the empty-record case (id=224 was a 15s zero-distance Wahoo recording). Combined with the existing `moving_time >= 600` filter, drops false starts and empty recordings before analysis.
- **Verified empirically:** ICU `/athlete/{id}/activities` list response includes `moving_time`, `distance`, `total_elevation_gain`, `average_temp`, `average_wind_speed`, `headwind_percent` directly on each item. The 16-item list for 2026-05-10 shows item[0] (real ride) keeps, item[1] (15s, null distance) drops, item[2] (5min, 1.88km) drops via moving_time. Confirms filters work.
- **Files touched:** [update-trend-and-context.js](archive/update-trend-and-context.js) (one-off update script), CLAUDE.md (this changelog).
- **Prompt size:** 6142 → 8074 chars. Still well within Sonnet 4.6 context budget.

### 2026-05-10 — Daily analysis decoupled from weekly plan
- **Hardcore Analysis prompt rewritten** in workflows `hrSGUqoAwkWQ4gKl` (Daily Checkin) and `rHIyZMIJNAOqZvM2` (Backfill) — both shared the same prompt verbatim and got the same rewrite.
- **Why:** production output graded a 2.5h / 70km Z2 ride as "C — No planned ride existed this week". User flagged this as scolding-for-training. The plan was never meant to be a contract; the bot inherited that framing from earlier prompt iterations.
- **What changed:**
  - Grade now reflects **session quality vs fitness profile** (zones held, pacing, cadence, drift, decoupling) — NOT plan adherence.
  - Removed the `⚠️ Off-plan — ` prefix and all "off-plan", "deviated from plan" language from the prompt rules.
  - Plan still passed to LLM as soft context — the prompt explicitly states "indicative, not a contract" and instructs the model to default to silence about the plan.
  - `plan_session_id` matching preserved for tracking only — has zero bearing on grade or message tone.
  - JSON output schema unchanged (`{plan_session_id, grade, message}`) so Parse Grade → Save Analysis → Send Telegram plumbing works as-is.
- **Files touched:** [update-prompt-no-plan-grading.js](archive/update-prompt-no-plan-grading.js) (one-off update script), CLAUDE.md (Workflow 1b output style + AI Coaching Logic section), [feedback_no_plan_grading.md](../../../../.claude/projects/-Users-arthurpfalzgraf-Desktop-Projects-TRI-COACH/memory/feedback_no_plan_grading.md) (memory).
- **Drafts pushed via PUT** — both workflows show `active=true` against the previous version. **Manual activation required** in n8n UI for each (click into workflow → Save) so draft becomes the running version. URLs:
  - https://apfz.app.n8n.cloud/workflow/hrSGUqoAwkWQ4gKl
  - https://apfz.app.n8n.cloud/workflow/rHIyZMIJNAOqZvM2
- **Verification pending:** manual execution test in n8n UI on a recent session, plus one Daily Checkin scheduled run at 20:10 Berlin.

### 2026-05-01 (later) — `/strikes` + `/training` Telegram commands
- Extended Coach Tri - Feedback Handler with two more inline command branches:
  - **`/strikes`** — clones Weekly Stats workflow's Code aggregation (no sub-workflow call). Returns running-week 🔥 per hour + per-sport breakdown, on demand instead of waiting for the 20:30 daily cron.
  - **`/training`** — `GET /weekly-plans?athlete_id=1&week_start_date=<this Monday>` then formats Mo-Su days as a single Telegram message with the week's Focus header.
- Routing chain now: Check Auth → Is /refresh? → Is /strikes? → Is /training? → Is Feedback? → drop. Each command branch uses the same `$('Telegram Trigger').item.json.message.chat.id.toString()` pattern for replies.

### 2026-05-01 — `/refresh` Telegram command + Save Session upsert fix + VPS Health retry
- **NEW WORKFLOW:** Coach Tri - Backfill (`rHIyZMIJNAOqZvM2`) — manual catch-up for late-uploaded activities. Triggered by `/refresh` on CroissantTri bot. Pulls last 7 days from Intervals.icu, filters ZEPP, runs analysis only for sessions where `analyzed_at` is null, sends one Telegram per new analysis with 📅 date prefix, ends with "✅ Refresh complete." Idempotent — safe to spam.
- **Coach Tri - Feedback Handler updated:** added `Is /refresh?` IF gate before existing `Is Feedback?` branch. Routes `/refresh` to Backfill via Execute Workflow node, then sends "✅ Refresh complete." after Backfill returns. Single bot, single webhook, dual-purpose.
- **DB BUG FIX:** `POST /sessions` was clobbering `analyzed_at` and `analysis` on every re-upsert because `ON CONFLICT DO UPDATE SET` blindly copied all columns. Daily Checkin worked anyway (it always re-analyzes after saving), but `/refresh` would have lost idempotency. Fixed: introduced `PRESERVE_ON_UPSERT` set in `server.js` (analysis, analyzed_at, grade, rpe, notes, user_feedback, user_feedback_at). Also changed POST response from `{id}` to `{id, analyzed_at}` so the workflow can short-circuit downstream when the session is already analyzed. Image rebuilt + redeployed (`docker compose up -d --build`).
- **VPS HEALTH MONITOR:** SSH node now retries 3× with 30s wait. Diagnoses the 06:00 2026-04-29 failure as a transient `ssh2 client-timeout` (n8n SSH client couldn't open a session within the 20s window — likely `unattended-upgrades`/`cron-apt` momentarily hammering sshd). One alert across the workflow's entire history; not a real outage.
- **Triplet bug encountered + fixed during build:** initial Backfill design used a nested `splitInBatches` v3 for activities, mirroring Daily Checkin. With >1 activity, the loop-back wiring (`Loop Over Activities out1 → Get Activities`) accumulated items across cycles — Get Activities re-fetched the same 12 activities each loop tick, Filter passed 3 each time, and on cycle 4 splitInBatches dumped all 9 accumulated items at once. Result: 3 Claude analyses for the same Wednesday ride. Daily Checkin doesn't trip this because it almost always has 1 activity per day. Fix: removed the inner loop entirely; n8n's natural per-item cascade handles iteration cleanly.
- Files touched: `db/server.js` (PRESERVE_ON_UPSERT + RETURNING analyzed_at), n8n workflows (Backfill created, Feedback Handler patched, VPS Health Monitor patched).

### 2026-04-25 (evening) — Public surface cleanup + secret incident
- **🔐 SECURITY INCIDENT — RESOLVED:** Public `claude.md` (lowercase, original repo init 2026-04-13) had been leaking live secrets for ~12 days. Found during a portfolio audit.
  - **Exposed:** Strava Client Secret, Intervals.icu API Key, VPS IP `187.124.8.143`, Telegram chat ID, n8n cloud URL, internal credential/workflow IDs.
  - **Rotated** in dashboards: Strava client secret + Intervals.icu API key (both 2026-04-25 ~20:00 Berlin). n8n API key intentionally NOT rotated (low blast radius).
  - **Purged** from history with `git-filter-repo --replace-text` across all 14 commits on all 4 branches. Every SHA changed; force-pushed to `origin`. Original commit `1a4c039` is still accessible via the GitHub API for ~90 days (dangling-commit window) — rotation is the actual protection, purge is hygiene.
  - **No forks** of the repo existed at the time of purge.
  - **gitleaks 8.30.1** installed via brew + pre-commit hook in `.git/hooks/pre-commit`. Scans staged content before every commit. Hook is currently NOT tracked (lives in `.git/hooks/`); move to `.githooks/` + `git config core.hooksPath .githooks` to share across machines.
  - **Local `claude.md`** now uses env-var refs (e.g. `see .env (TELEGRAM_CHAT_ID)`) instead of literal values. Committed.
  - **`backfill-sessions.js`** now requires `INTERVALS_API_KEY` in env (no fallback default).
  - **Still owed by user:** update local `TRI COACH/.env` with new Strava + ICU values; update n8n credential `JBZzr0E5U1GSy6OQ` (ICU); update Strava workflow node (`Q2KE0XGsc8NWLY8V`); `PUT /athletes/1` on tricoach-db to write new ICU key (otherwise Daily Check-in will 401).

- **PUBLISHED:** [`tricoach-db`](https://github.com/Arthurpfz/tricoach-db) as a standalone public repo. Clean copy of `db/` with proper README explaining the migration story (Airtable → self-hosted SQLite). Lives alongside the existing in-repo `db/` mirror — they're the same code; the standalone version exists for portfolio visibility and reuse.

- **REWROTE:** `tri-coach` README from scratch. Was leftover "N8N Workflow Manager" scaffolding from initial commit; now a proper architecture diagram, sample Telegram output, stack table, design philosophy. Cross-links to `tricoach-db`.

### 2026-04-25 — Sessions persistence + Weekly Stats
- **DEPLOYED:** Daily Checkin now persists workouts + analysis to `sessions` table
  - Redeployed `tricoach-db` container with extended schema (45+ session columns) and new `PATCH /sessions/:id` endpoint
  - Fixed upsert bug: `ON CONFLICT(athlete_id, intervals_id)` now includes the partial-index `WHERE intervals_id IS NOT NULL` clause SQLite requires
  - **Backfill:** ran [`backfill-sessions.js`](./backfill-sessions.js) for 2026-02-25 → 2026-04-25 → 12 clean sessions imported (idempotent via upsert)
  - **Workflow `hrSGUqoAwkWQ4gKl`:**
    - `Filter Activities` node added — drops all `source == 'ZEPP'` (armband records overlap COROS/WAHOO recordings, causing duplicate analyses)
    - `Save Session` and `Save Analysis` HTTP nodes added in flow `Get Activity Details → Save Session → ... → Hardcore Analysis → Save Analysis → Send Telegram`
    - Rest-day branch wired: `Check Activities Exist → false → Send Rest-Day Telegram`
    - `Hardcore Analysis` prompt rewritten — Telegram-native bulleted output (sport emoji header · Grade · 3 bullets · Tomorrow · Watch), plain text, ~6 lines, no markdown
  - **NEW WORKFLOW:** Coach Tri - Weekly Stats (`2W0SIHwzyAWJW62Q`) — daily 20:30 cumulative weekly volume Telegram (🔥 per hour + per-sport breakdown)
  - **REMOVED:** SANDBOX Daily Checkin v2 (`YwxiGs57HWnPdseR`) — its streams/wellness/intervals enrichment was not adopted into prod; deleted both n8n workflow and local `sandbox-daily-checkin-v2.json`

### 2026-04-22
- **MIGRATED:** Airtable → self-hosted SQLite REST API (`tricoach-db`)
  - **Reason:** Airtable PAT/OAuth blocked at account level, $30/mo wasted
  - **Service:** Node 20 + Express + `better-sqlite3`, deployed at `/data/tricoach-db/` on Hostinger VPS
  - **Public URL:** `https://coach-db.arthurpfz.com` (Traefik + LetsEncrypt)
  - **DNS:** A record on Netlify DNS (domain `arthurpfz.com`)
  - **n8n:** Created credential "Tricoach DB" (`6GNzKYNE1JAz77RL`, httpHeaderAuth)
  - **Workflows updated:** Daily Checkin, Sunday Planner, SANDBOX — all Airtable nodes replaced with HTTP Request nodes
  - **Trick:** API response uses Airtable-compatible field names so AI prompt expressions didn't need editing
  - **Data migrated:** 1 athlete + 16 weekly plans via `./db/migrate.js` (idempotent, can re-run)
  - **Relay:** Added `tricoach-db-status`, `tricoach-db-logs`, `tricoach-db-restart` operations
  - **Verified:** All 5 API paths (GET/PUT/POST) via HTTPS end-to-end
  - **Airtable cancellation:** safe after one successful scheduled run of each workflow

### 2026-04-18
- **DEPLOYED:** Idempotency gate + error handler wiring across all daily-checkin workflows
  - New workflow: **Coach Tri - Error Handler** (ID: `psyVgPiGJoO5QOa4`) — Error Trigger → Telegram alert
  - Wired `settings.errorWorkflow = psyVgPiGJoO5QOa4` on all 3 main workflows
  - New Airtable field: **Last Coaching Date** (`singleLineText`, ID `fldLdvY3ZOiTuXkuy`) on Users table
  - Added `Already Coached Today?` IF node as first gate after Loop Over Users in all 3 workflows — short-circuits if `Last Coaching Date` == today
  - On Intervals.icu + SANDBOX workflows: moved `Update Coaching Date` to immediately after the idempotency gate (before `Get Activities`), so date is written on rest days too
  - Fixed `Get Activities` URL in ICU workflows to use `$('Loop Over Users').item.json['Intervals.icu Athlete ID']` (absolute reference survives node reordering)
  - **Source branch:** `claude/review-tri-coach-n8n-XpXqM` in `Arthurpfz/tri-coach`
  - **Known n8n behavior:** `settings.errorWorkflow` only fires on automated (schedule/webhook) runs, not manual executions. Validated indirectly — first live test will be next scheduled run failure.

### 2026-01-25
- **DEPLOYED & TESTED:** Intervals.icu Integration
  - **Final Workflow ID:** hrSGUqoAwkWQ4gKl
  - **Final Credential ID:** JBZzr0E5U1GSy6OQ (HTTP Basic Auth)
  - **Status:** Active and fully tested with real activity data

  **Integration Details:**
  - Integrated Intervals.icu API for full FIT file data access
  - Upgraded AI model: Claude 3.7 Sonnet (from 3.5 in Strava workflow)
  - Enhanced analysis framework (6-10 sentences vs 4 sentences)
  - Schedule: Daily 20:10 Europe/Berlin
  - Added Airtable fields: `Intervals.icu Athlete ID` (i492254), `Intervals.icu API Key`

  **Technical Analysis Capabilities:**
  - Power analysis (avg, normalized, VI, max, decoupling, pacing strategy)
  - Cardiovascular metrics (cardiac drift, efficiency factor, HR zone distribution)
  - Cadence assessment (consistency, sport-specific targets: 170-180spm run, 85-95rpm bike)
  - Training load analysis (TSS, intensity factor, TRIMP)
  - Interval structure detection and quality assessment across reps
  - Training phase contextualization
  - Execution grading (A/B/C/F vs planned workout)

  **Issues Encountered & Resolved:**
  1. Missing credential reference → Created HTTP Basic Auth credential via API
  2. URL construction with spaces → Added `.trim()` to athlete ID field reference
  3. Type conversion error (string vs number) → Enabled type validation in Check Activities node
  4. Check Activities condition always false → Changed from `{{ $json.length }}` to `{{ $input.all().length }}`
  5. Wrong node reference in URL → Fixed to use `{{ $('Loop Over Users').item.json['...'] }}`
  6. 403 Forbidden errors → Recreated credential with correct ID
  7. Strava API blocking issue → Identified that Intervals.icu API blocks Strava-sourced activities
  8. Workflow redeployment losing manual fixes → Stopped redeploying, fixed issues in JSON before final deploy

  **Data Source Discovery:**
  - Intervals.icu API blocks access to Strava-sourced activities
  - Solution: Disconnected Strava from Intervals.icu, connected Zwift directly
  - Supported sources: Direct device uploads (COROS, Wahoo, Garmin, Zwift direct)

  **Deployment Scripts Created:**
  - `test-intervals-icu.js` - API connection test
  - `recreate-credential.js` - Credential management
  - `fix-all-issues.js` - Multi-issue fix deployment
  - `final-redeploy.js` - Final working deployment

  **Documentation:**
  - Added Intervals.icu Integration section to CLAUDE.md
  - Documented data source requirements and Strava limitation
  - Updated workflow IDs and credential references
  - Added troubleshooting notes for future reference

### 2026-01-24
- **FIXED:** Daily Check-in 401 Strava Authorization Error
  - Issue: "Get Activities" node used expired token from Airtable
  - Fix: Updated to use freshly refreshed token from "HTTP Request" node
  - Published workflow version aa1d3cdb (version counter: 24)
- Connected to N8N Cloud instance
- Created local Node.js API client
- Generated workflow analysis documentation
- Added troubleshooting section to claude.md

### 2026-01-18
- Updated Daily Check-in workflow (last update)
- Updated Sunday Planner workflow (last update)

### 2026-01-07
- Activated Daily Check-in workflow version 32386d34

### 2026-01-05
- Activated Sunday Planner workflow version ca59f26f

### 2026-01-03
- Created both workflows
- First successful workflow execution (Sunday Planner)

---

## Quick Reference

### Important IDs
- **N8N Base URL:** https://apfz.app.n8n.cloud/api/v1
- **Tricoach DB URL:** https://coach-db.arthurpfz.com
- **Tricoach DB path on VPS:** /data/tricoach-db
- ~~**Airtable Base:** appw0Xd3T54okfaXa~~ — migrated to Tricoach DB 2026-04-22
- **Users Table:** tblK8jxVIxuFi9H8Z
- **Weekly Plans Table:** tblJ0UHyJ1drXv97F
- **Daily Check-in Workflow (Intervals.icu):** hrSGUqoAwkWQ4gKl
- **Weekly Stats Workflow:** 2W0SIHwzyAWJW62Q
- **Backfill Workflow (/refresh):** rHIyZMIJNAOqZvM2
- **Feedback Handler Workflow:** gAnJ0r3x0sFxqWxY
- **Error Handler Workflow:** psyVgPiGJoO5QOa4
- **Sunday Planner Workflow:** lUcAtn2oxCPkNkJ1
- **Monthly Review Workflow:** AA2oAY6ZPu5i1c7I
- **Telegram Chat:** see `.env` (`TELEGRAM_CHAT_ID`)
- **Last Coaching Date field ID:** fldLdvY3ZOiTuXkuy
- **Intervals.icu Athlete ID:** i492254

### Useful Commands
```bash
# Test N8N connection
npm test

# Run workflow examples
npm run examples

# Analyze workflow structure
node analyze-workflows.js

# Troubleshooting commands
node check-executions.js      # Check recent execution status
node debug-execution.js        # Get detailed execution errors
node check-versions.js         # Compare draft vs active versions
```

---

## Notes

- Both workflows are currently **ACTIVE** and running in production
- System timezone: **Europe/Berlin**
- Primary use case: Personal triathlon training for Ironman preparation
- MVP status: Functional and actively used, ready for enhancements

---

*Last Updated: 2026-07-12 (wellness/readiness, auto test detection, cadence trend, race-week module, Monthly Review)*
