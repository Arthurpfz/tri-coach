# ✅ Intervals.icu Integration - DEPLOYMENT COMPLETE

## Status: LIVE & ACTIVE

**Workflow ID:** 1IFMn9sjPXwX7APq
**Schedule:** Daily at 20:10 (Europe/Berlin)
**Next Run:** Tonight at 20:10
**Status:** ✅ Active and ready

---

## What's Running

You now have TWO daily check-in workflows:

### 1. Strava Check-in (20:05) - Legacy
- Basic activity tracking
- 4-sentence coaching messages
- Claude 3.5 Sonnet
- Fallback system

### 2. Intervals.icu Check-in (20:10) - New ⭐
- Full FIT file analysis
- 6-10 sentence technical coaching
- Claude 3.7 Sonnet
- Comprehensive metrics

---

## How It Works Tonight

**20:05** - Strava workflow runs (basic check-in)
**20:10** - Intervals.icu workflow runs with:

1. **Fetch Activities**
   - Pulls today's activities from Intervals.icu API
   - Filters out Strava-sourced duplicates
   - Only analyzes COROS, Wahoo, Zwift direct uploads

2. **Get Detailed Metrics**
   - Power: avg, normalized, variability index, max
   - Heart Rate: avg, max, zone distribution
   - Cadence: consistency analysis
   - Training Load: TSS, Intensity Factor, TRIMP
   - Intervals: auto-detected structure

3. **Retrieve Training Plan**
   - Fetches this week's plan from Airtable
   - Gets today's prescribed workout

4. **AI Analysis (Claude 3.7 Sonnet)**
   - Execution grading (A/B/C/F)
   - Power analysis (pacing, VI, decoupling)
   - Cardiovascular metrics (cardiac drift, efficiency)
   - Cadence assessment (sport-specific targets)
   - Training load appropriateness
   - Physiological indicators

5. **Send Coaching Message**
   - Telegram delivery
   - 6-10 sentences
   - Data-driven, specific feedback
   - No emoji prefix, clean message

---

## What You'll Receive

### Example Telegram Message (Tonight)

```
Clean execution of the 90min Z2 ride. Power at 245W avg (85% FTP),
NP 258W, VI 1.05 - textbook steady pacing. Cadence held 90-94rpm
with <3% variation. Cardiac drift only 5.2% (148→156bpm) - aerobic
ceiling rising. Small flag: last 20min saw 8W power drop while HR
held, suggesting glycogen depletion. TSS 78 slots perfectly into
Base 2. Decoupling 1.03 shows strong efficiency. Easy spin tomorrow.
```

---

## Technical Stack

**Data Source:**
- Intervals.icu API (full FIT file metrics)
- Athlete ID: i492254
- API Key: INTERVALS_API_KEY_REDACTED

**Processing:**
- N8N Cloud workflow automation
- Airtable database (Users + Weekly Plans)
- Claude 3.7 Sonnet via OpenRouter

**Delivery:**
- Telegram Bot
- Chat ID: TELEGRAM_CHAT_ID_REDACTED

**Credentials Created:**
- HTTP Basic Auth (ID: LeGFB4Wmg015clTL)
- Username: API_KEY
- Password: [Intervals.icu API key]

---

## Airtable Configuration

Added to **Users** table:
- `Intervals.icu Athlete ID` = i492254
- `Intervals.icu API Key` = INTERVALS_API_KEY_REDACTED

---

## Available Metrics

### Currently Analyzed
- Power (avg, normalized, VI, max)
- Heart Rate (avg, max, zone distribution)
- Cadence (avg, consistency)
- Pace/Speed
- Training Load (TSS, IF, TRIMP)
- Interval structure (auto-detected)
- Device source
- Duration (moving + elapsed)

### Available for Future Enhancement
- Time-series streams data:
  * Power curve analysis
  * HR variability within session
  * Cadence drift over time
  * Pace consistency quartiles
  * Form degradation indicators
  * Running dynamics (stride length, vertical oscillation, ground contact time)

---

## Files Created

1. `intervals-icu-workflow.json` - Workflow definition
2. `test-intervals-icu.js` - API connection tester
3. `check-airtable.js` - Airtable field checker
4. `verify-and-test.js` - Workflow status checker
5. `INTERVALS-ICU-DEPLOYMENT.md` - Technical documentation
6. `DEPLOYMENT-COMPLETE.md` - This file

---

## Monitoring & Troubleshooting

### Check Workflow Status
```bash
node verify-and-test.js
```

### Test Intervals.icu API
```bash
node test-intervals-icu.js
```

### View Recent Executions
Go to: https://apfz.app.n8n.cloud/executions

### View Workflow
Go to: https://apfz.app.n8n.cloud/workflow/1IFMn9sjPXwX7APq

---

## What's Next

The workflow will run automatically tonight at 20:10 Berlin time. If you have activities from today uploaded to Intervals.icu (from COROS, Wahoo, or Zwift), you'll receive comprehensive technical analysis.

If there are no activities today, the workflow will complete silently (no Telegram message).

---

**Deployed:** 2026-01-25
**Status:** ✅ Production Active
**Next Execution:** Tonight 20:10 (Europe/Berlin)
