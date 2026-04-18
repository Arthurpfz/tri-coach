# Tri Coach - AI-Powered Triathlon Coaching System

## Project Overview

This is an **automated triathlon coaching system** that creates personalized weekly training plans and provides daily performance feedback by analyzing the session actually performed — not compared to a plan, but evaluated on its own merits.

**Status:** Production (Active)
**Author:** Arthur Pfalzgraf
**Primary Athlete:** Arthur Pfalzgraf

---

## System Architecture

### Tech Stack

- **N8N Cloud**: Workflow automation platform (https://apfz.app.n8n.cloud)
- **Airtable**: Database for users, plans, and athlete data
  - Base: "Tri Coach MVP" (appw0Xd3T54okfaXa)
- **Strava API**: Activity tracking and OAuth integration
- **Claude AI**: Coaching intelligence (via OpenRouter)
  - Models: Claude 3.5 Sonnet (check-ins), Claude 3.7 Sonnet (planning)
- **Telegram**: Communication channel (Chat ID: TELEGRAM_CHAT_ID_REDACTED)

### Data Flow

```
Sunday 8:07 PM → Generate Weekly Plan → Store in Airtable → Send to Telegram
Daily 8:05 PM → Fetch Today's Activities → AI Analysis (session-first, no plan comparison) → Feedback to Telegram
```

---

## Active Workflows

### 1. Coach Tri - Daily Checkin (Strava - LEGACY)
- **ID:** Q2KE0XGsc8NWLY8V
- **Active Version:** aa1d3cdb-f231-4b8c-a2c1-8430216fc13b (v24)
- **Schedule:** Daily at 20:05 (Europe/Berlin)
- **Purpose:** Basic activity tracking via Strava API
- **Status:** ✅ Active (fallback system)
- **AI Model:** Claude 3.5 Sonnet

### 1b. Coach Tri - Daily Checkin (Intervals.icu) ⭐
- **ID:** hrSGUqoAwkWQ4gKl
- **URL:** https://apfz.app.n8n.cloud/workflow/hrSGUqoAwkWQ4gKl
- **Schedule:** Daily at 20:10 (Europe/Berlin)
- **Purpose:** Advanced technical analysis with full FIT file data
- **Status:** ✅ Active and Tested (2026-01-25)
- **AI Model:** Claude 3.7 Sonnet
- **Data Source:** Intervals.icu API (full FIT file metrics + time-series streams)
- **Credential ID:** JBZzr0E5U1GSy6OQ (HTTP Basic Auth)

**IMPORTANT - Data Source Requirements:**
- Activities must come from **direct device uploads** to Intervals.icu
- Supported: COROS, Wahoo, Garmin (direct), Zwift (direct connection)
- **Strava must be disconnected** from Intervals.icu
- Reason: Intervals.icu API blocks access to Strava-sourced activities
- Activities uploaded via Strava will not be analyzed by this workflow

**Workflow Flow:**
1. Fetch all users from Airtable
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
8. Fetch weekly plan from Airtable (kept in graph but no longer used in prompt)
9. Send comprehensive data to Claude 3.7 Sonnet with rigorous analysis framework
10. Claude performs technical analysis:
    - Session intent inference + execution grading (A/B/C/F on own merits, NOT vs plan)
    - Power analysis (VI, decoupling, pacing strategy)
    - Cardiovascular analysis (cardiac drift, efficiency factor, HR zones)
    - Cadence assessment (consistency, sport-specific appropriateness)
    - Interval quality (structure, consistency across reps)
    - Training phase context and progression
    - Specific coaching points with exact metrics
11. Send 6-10 sentence technical coaching message via Telegram

**Output Style:**
- Rigorous and analytical
- Data-driven with specific numbers
- Supportive but brutally honest
- No fluff or generic praise
- Professional coach-to-serious-athlete tone

**Example Feedback:**
```
Clean execution of the 90min Z2 ride. Power at 245W avg (85% FTP), NP 258W,
VI 1.05 - textbook steady pacing. Cadence held 90-94rpm with <3% variation.
Cardiac drift only 5.2% (148→156bpm) - aerobic ceiling rising. Small flag:
last 20min saw 8W power drop while HR held, suggesting glycogen depletion.
TSS 78 slots perfectly into Base 2. Decoupling 1.03 shows strong efficiency.
Easy spin tomorrow.
```

### 2. Coach Tri - Sunday Planner
- **ID:** lUcAtn2oxCPkNkJ1
- **Active Version:** ca59f26f-c598-4238-b3e0-03aa467b9c3b (v18)
- **Schedule:** Weekly on Sunday at 20:07 (Europe/Berlin)
- **Purpose:** Generate personalized weekly training plan for next week
- **Status:** ✅ Working correctly

**Flow:**
1. Fetch user "Arthur Pfalzgraf" from Airtable
2. Send profile to Claude with:
   - Race name & date
   - Training phase (Base/Build/Peak/Taper)
   - Fitness profile (HR zones, paces, power, CSS)
   - Personal constraints
3. Claude generates structured JSON plan for next week
4. Parse JSON response
5. Create record in "Weekly Plans" table
6. Send formatted plan via Telegram

**AI Model:** Claude 3.7 Sonnet
**Session Labels:** KEY, OPTIONAL (Easy), OPTIONAL (Intensity), REST

**Planning Philosophy:**
- Constraints are non-negotiable
- Phase-appropriate training intensity
- Max 1 OPTIONAL (Intensity) session per week
- OPTIONAL (Intensity) never day before KEY session
- Uses exact values from Fitness Profile

---

## Airtable Schema

### Users Table (tblK8jxVIxuFi9H8Z)

```
- id (record ID)
- Name (string)
- Phone (string)
- Race Name (string)
- Race Date (date)
- Training Phase (string): Base 1, Base 2, Build 1, Build 2, Peak, Taper
- Fitness Profile (long text): HR zones, paces, power, CSS
- Constraints (long text): Personal limitations/preferences
- Strava Refresh Token (string)
- Strava Access Token (string)
- Token Expires At (number): Unix timestamp
- Last Activity Sync (number): Unix timestamp
- Intervals.icu Athlete ID (string): Format i123456
- Intervals.icu API Key (string): Personal API key from Settings
- Intervals.icu Last Sync (number): Unix timestamp
```

**Current Values (Arthur Pfalzgraf):**
- Intervals.icu Athlete ID: `i492254`
- Intervals.icu API Key: `INTERVALS_API_KEY_REDACTED`

### Weekly Plans Table (tblJ0UHyJ1drXv97F)

```
- id (record ID)
- Week Start Date (dateTime): Monday of the week
- Athlete (linked record): Links to Users table
- Focus (string): 1-2 sentence weekly focus
- Monday (string): Training plan for Monday
- Tuesday (string): Training plan for Tuesday
- Wednesday (string): Training plan for Wednesday
- Thursday (string): Training plan for Thursday
- Friday (string): Training plan for Friday
- Saturday (string): Training plan for Saturday
- Sunday (string): Training plan for Sunday
```

---

## Intervals.icu Integration

### API Configuration
- **Base URL:** https://intervals.icu/api/v1
- **Authentication:** HTTP Basic Auth
  - Username: `API_KEY` (literal string)
  - Password: User's personal API key
- **Credential ID:** JBZzr0E5U1GSy6OQ
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

## Strava Integration (Legacy)

### OAuth Configuration
- **Client ID:** 193431
- **Client Secret:** Stored in N8N workflow (STRAVA_CLIENT_SECRET_REDACTED)
- **Token Refresh:** Automatic when expiring within 30 minutes
- **API Endpoint:** https://www.strava.com/api/v3/

### Token Management Flow
1. Check: Is token expiring within 30 minutes?
2. If yes: POST to /oauth/token with refresh_token
3. Update Airtable with new access_token, refresh_token, expires_at
4. Reset Last Activity Sync to 0

### Activity Fetching
- **Endpoint:** /athlete/activities
- **Filter:** `after` = today at midnight (Europe/Berlin)
- **Authorization:** Bearer token in headers
- **Output:** Always outputs data even if empty

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

### Daily Check-In Analysis (Claude 3.5 Sonnet)

**Context Provided:**
- Current date and day of week
- Athlete name
- Today's Strava activities (raw data)

**Analysis Logic:**
The athlete's schedule shifts often — the daily analysis does NOT compare to a weekly plan. The session is judged on its own merits.

1. **If there is an activity:**
   - Identify the sport and likely intent (endurance / tempo / threshold / intervals / long / recovery)
   - Give specific feedback on pace, heart rate, duration, and effort
   - Call out one thing that went well and one thing to watch

2. **If there is no activity:**
   - Treat it as a rest or off day — supportive nudge, no moralising

**Output Requirements:**
- WhatsApp message to the athlete
- Tone: "Coach" — short, punchy, human
- Data-driven: cite the actual numbers
- Max 4 sentences
- No preamble, just the message

### Weekly Planning (Claude 3.7 Sonnet)

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
- **Daily Check-in:** 20:05 (8:05 PM)
- **Weekly Planning:** Sunday 20:07 (8:07 PM)

### Credentials Used
- Airtable Personal Access Token (ID: JMbdFoTWoGU3avK9)
- OpenRouter API (ID: nhbNqmgyP4cAeQ6B)
- Telegram API (ID: 9IpAp35yJmIQJpeA)
- Intervals.icu HTTP Basic Auth (ID: JBZzr0E5U1GSy6OQ)

### Active User
- **Name:** Arthur Pfalzgraf
- **Telegram Chat ID:** TELEGRAM_CHAT_ID_REDACTED

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
2. **Single Source of Truth:** Airtable as central database
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

### 2026-04-18
- **CHANGED:** Daily analysis prompts — all three workflows updated to focus on actual session performed, not plan comparison
  - Removed plan-vs-actual match/swap/rogue logic from `workflow-daily-checkin.json` (Strava legacy)
  - Removed `PLANNED SESSION` block and plan-match grading from `intervals-icu-workflow.json` (Intervals.icu main)
  - Same for `sandbox-daily-checkin-v2.json`
  - **Reason:** Athlete's schedule shifts often; plan comparison was noisy and unhelpful
  - New approach: infer session intent from data, grade execution on its own merits (pacing coherence, intensity appropriateness), training-phase context retained
  - `Search Plan` Airtable nodes left in graph but no longer referenced in prompts

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
  - Session intent inference and execution grading (A/B/C/F on own merits)

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
- **Airtable Base:** appw0Xd3T54okfaXa
- **Users Table:** tblK8jxVIxuFi9H8Z
- **Weekly Plans Table:** tblJ0UHyJ1drXv97F
- **Daily Check-in Workflow (Strava - Legacy):** Q2KE0XGsc8NWLY8V
- **Daily Check-in Workflow (Intervals.icu):** hrSGUqoAwkWQ4gKl
- **Sunday Planner Workflow:** lUcAtn2oxCPkNkJ1
- **Telegram Chat:** TELEGRAM_CHAT_ID_REDACTED
- **Strava Client ID:** 193431
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

*Last Updated: 2026-04-18 (Daily analysis switched to session-first, no plan comparison)*
