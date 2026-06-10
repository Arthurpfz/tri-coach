# Intervals.icu Integration - Deployment Summary

## What Was Built

Enhanced daily check-in workflow that analyzes full FIT file data from Intervals.icu for comprehensive technical coaching feedback.

## Workflow Details

- **Name:** Coach Tri - Daily Checkin (Intervals.icu)
- **ID:** 1IFMn9sjPXwX7APq
- **Schedule:** Daily at 20:10 (Europe/Berlin)
- **AI Model:** Claude 3.7 Sonnet
- **Status:** Created, pending activation

## Key Improvements vs Strava Workflow

### Data Richness
- **Strava:** Summary metrics only (avg power, avg HR, distance, duration)
- **Intervals.icu:** Full FIT file data including:
  - Normalized Power & Variability Index
  - HR zone distribution (time in each zone)
  - Cadence analysis
  - Training load (TSS, IF, TRIMP)
  - Auto-detected interval structure
  - Available stream types for future analysis

### Analysis Depth
- **Strava:** Basic execution check (4 sentences)
- **Intervals.icu:** Comprehensive technical analysis (6-10 sentences):
  - Execution grading (A/B/C/F)
  - Power analysis (VI, pacing, decoupling)
  - Cardiovascular metrics (cardiac drift, efficiency)
  - Cadence assessment (sport-specific targets)
  - Training load appropriateness
  - Physiological indicators

### AI Model
- **Strava:** Claude 3.5 Sonnet
- **Intervals.icu:** Claude 3.7 Sonnet

## How It Works

1. Fetches today's activities from Intervals.icu API
2. Filters out Strava-sourced duplicates (keeps COROS, Wahoo, Zwift direct uploads)
3. Fetches detailed activity data with full FIT metrics
4. Retrieves weekly training plan from Airtable
5. Sends comprehensive data to Claude 3.7 Sonnet for analysis
6. Delivers technical coaching message via Telegram

## Example Output

**Before (Strava):**
```
Strong run this morning! Nailed the easy pace at 5:30/km, HR stayed in Z2
(140bpm avg). Form is building nicely. Rest day tomorrow.
```

**After (Intervals.icu):**
```
Clean execution of the 90min Z2 ride. Power at 245W avg (85% FTP), NP 258W,
VI 1.05 - textbook steady pacing. Cadence held 90-94rpm with <3% variation.
Cardiac drift only 5.2% (148→156bpm) - aerobic ceiling rising. Small flag:
last 20min saw 8W power drop while HR held, suggesting glycogen depletion.
TSS 78 slots perfectly into Base 2. Decoupling 1.03 shows strong efficiency.
Easy spin tomorrow.
```

## Files Created

- `intervals-icu-workflow.json` - N8N workflow definition
- `test-intervals-icu.js` - Intervals.icu API connection test
- `activate-intervals-workflow.sh` - Quick activation script
- `INTERVALS-ICU-DEPLOYMENT.md` - This file

## Configuration

### Airtable Updates
Added to Users table:
- `Intervals.icu Athlete ID` - i492254
- `Intervals.icu API Key` - INTERVALS_API_KEY_REDACTED

### Intervals.icu API
- **Authentication:** HTTP Basic (API_KEY / {api_key})
- **Endpoints Used:**
  - `GET /api/v1/athlete/{athleteId}/activities` - Today's activities
  - `GET /api/v1/activity/{activityId}` - Detailed metrics

## Activation Steps

1. Open workflow: https://apfz.app.n8n.cloud/workflow/1IFMn9sjPXwX7APq
2. Click "Inactive" toggle in top right
3. Workflow will run tonight at 20:10 Berlin time

Or run:
```bash
./activate-intervals-workflow.sh
```

## Both Workflows Running

You now have two check-in workflows:

1. **Strava (20:05)** - Basic activity tracking (fallback)
2. **Intervals.icu (20:10)** - Advanced technical analysis

Both can run simultaneously. Intervals.icu will filter out Strava activities to avoid duplicates.

## Next Enhancements (Future)

- Fetch time-series streams for advanced analysis:
  * Power curve analysis
  * HR variability within session
  * Cadence drift detection
  * Form degradation over duration
- Historical trend tracking in Airtable
- Weekly summary reports
- Predictive fatigue modeling
- Automated plan adjustments based on execution quality

---

**Deployed:** 2026-01-25
**Status:** Ready for activation
