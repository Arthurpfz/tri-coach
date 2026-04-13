# Intervals.icu Integration - Implementation Guide

## Architecture Overview

Your current data flow is optimal:
```
COROS Pace/Swift → Intervals.icu (preserves full FIT data)
Wahoo ELEMNT → Intervals.icu
Zwift → Intervals.icu
                ↓
         Intervals.icu API
                ↓
            N8N Workflow
                ↓
      Claude AI Analysis (with FIT streams data)
                ↓
         Telegram Coaching Feedback
```

**Why This Works:**
- ✅ Intervals.icu preserves full FIT files (unlike Strava)
- ✅ Automatic sync from COROS/Wahoo
- ✅ Deduplication handled by Intervals.icu
- ✅ Device priority managed automatically
- ✅ API access to time-series streams (cadence, power, HR, form metrics)

## Before We Build - Quick Questions

### 1. Intervals.icu Credentials
Do you have:
- [ ] Your Intervals.icu athlete ID? (visible in URL: intervals.icu/athlete/i**XXXXX**)
- [ ] Your API key? (Settings → Developer Settings → Create API Key)

### 2. Workflow Strategy
Which approach do you prefer:
- **Option A**: Keep both workflows (Strava + Intervals.icu running in parallel)
  - Pro: Redundancy, compare both systems
  - Con: Two Telegram messages daily

- **Option B**: Replace Strava with Intervals.icu
  - Pro: Single daily message with richer insights
  - Con: Lose Strava social/simple tracking

- **Option C**: Run Intervals.icu only, keep Strava for token management (it updates Airtable)
  - Pro: Best of both, deep analysis from Intervals.icu
  - Con: Slight complexity

**My Recommendation:** Option C

### 3. Technical Analysis Depth
How detailed should Claude's technical feedback be?

- **Concise (4 sentences)** - Like current Strava version
  ```
  "Strong bike session! Avg power 245W (85% FTP), normalized 258W.
  Cadence rock-solid at 92rpm. Slight cardiac drift (+5bpm) suggests
  you're at limit of Z2 - perfect. Recovery tomorrow."
  ```

- **Detailed (6-8 sentences)** - Full technical breakdown
  ```
  "Solid 60min endurance ride! Avg 245W (85% FTP), normalized 258W,
  variability index 1.05 - excellent steady pacing. Cadence 90-94rpm
  throughout, optimal for aerobic work. HR averaged 152bpm (Z2) but
  drifted from 148→156bpm over the hour (5.4% drift) - normal for
  sustained Z2, shows you're right at aerobic ceiling. Power:HR
  decoupling only 3.2% - your aerobic fitness is strong. Great
  foundation work."
  ```

**My Recommendation:** Detailed (you're paying for this data, use it!)

### 4. Activity Storage
Should we save detailed activity data to Airtable?

- **Yes** - Create "Activities" table with all metrics
  - Pro: Historical tracking, trend analysis, weekly summaries
  - Pro: Can query "show me all runs where cadence < 175"
  - Con: More Airtable records, slight complexity

- **No** - Just analyze and send to Telegram
  - Pro: Simpler, faster
  - Con: No historical record, can't do trend analysis

**My Recommendation:** Yes (enables future enhancements like weekly trend reports)

### 5. Streams Data Usage
Which metrics matter most for your coaching?

**Running:**
- [x] Cadence (spm)
- [x] Stride length
- [x] Vertical oscillation
- [x] Ground contact time
- [x] Power (if COROS Pace 3)
- [x] HR & HR variability
- [x] Pace consistency

**Cycling:**
- [x] Power (avg, normalized, variability)
- [x] Cadence consistency
- [x] HR drift
- [x] Power:HR decoupling

**Swimming:**
- [x] Stroke rate
- [x] SWOLF
- [x] Pace per 100m
- [x] Stroke efficiency

**My Assumption:** All of the above (comprehensive analysis)

## Implementation Plan

### Phase 1: Quick Setup (5 minutes)
```bash
# 1. Get your Intervals.icu credentials
# Go to: https://intervals.icu/settings
# Scroll to "Developer Settings"
# Click "Create API Key"
# Copy: Athlete ID (i12345) and API Key

# 2. Update Airtable
# Add columns to Users table:
#   - Intervals.icu Athlete ID
#   - Intervals.icu API Key
#   - Intervals.icu Last Sync

# 3. Provide me with:
#   - Your Athlete ID
#   - Your API Key
```

### Phase 2: Workflow Build (I'll do this)
1. Duplicate existing Daily Check-in workflow
2. Rename: "Coach Tri - Daily Checkin (Intervals.icu)"
3. Update schedule: 20:10 (5 min after Strava)
4. Replace Strava nodes with Intervals.icu nodes:
   - Get Activities (filtered by today)
   - Get Activity Details + Streams
5. Enhance Claude prompt for technical analysis
6. Test with your actual data

### Phase 3: Enhanced Prompts
I'll create prompts that analyze:

**Workout Execution (existing logic):**
- Does activity match plan?
- Duration/intensity appropriate?
- Logical swaps?

**Technical Analysis (NEW):**

For **Running**:
```
- Cadence: Target 170-180spm, assess efficiency
- Stride mechanics: Length, vertical oscillation, ground contact time
- Power (if available): Pacing consistency, hills
- HR response: Appropriate for effort, drift analysis
- Pace: Consistency, positive/negative splits
- Form degradation: Metrics worsening over duration?
```

For **Cycling**:
```
- Power execution: Target zones met, variability appropriate
- Cadence patterns: Steady 85-95rpm for endurance
- Normalized power: Smooth or erratic?
- Intensity Factor: Appropriate for session type
- Power:HR decoupling: Fatigue indicators
- Indoor vs outdoor: Pacing differences
```

For **Swimming**:
```
- Pace consistency: Per 100m splits
- Stroke rate: Appropriate for target pace
- SWOLF: Efficiency score, improving over session?
- Intervals execution: Rest ratios, pace maintenance
```

### Phase 4: Advanced Features (Future)
- Weekly summary: Trend analysis across the week
- Form tracking: Monitor vertical oscillation, cadence trends
- Fatigue indicators: HR drift, power:HR decoupling over time
- Sensor fusion: Combine COROS + Wahoo data when both present

## Sample Workflow Structure

```
1. Schedule Trigger (20:10 daily)
   ↓
2. Search Users (Airtable)
   ↓
3. Loop Over Users
   ↓
4. HTTP Request: Get Today's Activities
   GET https://intervals.icu/api/v1/athlete/{athleteId}/activities
   Auth: Basic (API_KEY / {api_key})
   Query: oldest=2026-01-24T00:00:00&newest=2026-01-24T23:59:59
   ↓
5. Filter: Only process if activities exist
   ↓
6. Loop Over Activities
   ↓
7. HTTP Request: Get Activity Details
   GET https://intervals.icu/api/v1/activity/{activityId}
   Returns: Full activity with streams_types, intervals, laps
   ↓
8. (Optional) HTTP Request: Get Activity Streams
   GET https://intervals.icu/api/v1/activity/{activityId}/streams.csv
   Returns: Time-series data (watts, hr, cadence, etc.)
   ↓
9. Calculate Monday (for weekly plan fetch)
   ↓
10. Search Plan (Airtable: Weekly Plans)
   ↓
11. Enhanced LLM Chain (Claude 3.5 Sonnet)
    Context:
    - Weekly plan (all 7 days)
    - Today's activity summary
    - Streams data (power, HR, cadence, form)
    - Athlete fitness profile

    Prompt:
    - Analyze execution vs plan
    - Assess technical execution
    - Provide specific coaching feedback
    - Identify patterns or concerns
    ↓
12. (Optional) Update Airtable Activities
    Save activity + technical notes
    ↓
13. Send Telegram Message
    Rich technical coaching feedback
```

## Enhanced Claude Prompt (Preview)

```javascript
You are an expert Ironman coach analyzing workout data from Intervals.icu (full FIT file data).

CONTEXT:
- Date: {{ $today }}
- Athlete: {{ $('Loop Over Users').item.json.Name }}
- Training Phase: {{ $('Loop Over Users').item.json['Training Phase'] }}

PLANNED WORKOUT (Today):
{{ $json.today_plan }}

ACTUAL WORKOUT (Intervals.icu):
Type: {{ $json.type }}
Duration: {{ $json.moving_time }}s ({{ $json.moving_time / 60 }}min)
Distance: {{ $json.distance }}m

SUMMARY METRICS:
- Avg Power: {{ $json.avg_watts }}W
- Normalized Power: {{ $json.weighted_avg_watts }}W
- Variability Index: {{ $json.variability_index }}
- Avg HR: {{ $json.avg_hr }}bpm
- Avg Cadence: {{ $json.avg_cadence || $json.avg_run_cadence }}
- TSS: {{ $json.training_load }}
- Intensity Factor: {{ $json.intensity }}

STREAMS DATA (if available):
- Power stream: {{ $json.streams.watts }}
- HR stream: {{ $json.streams.heartrate }}
- Cadence stream: {{ $json.streams.cadence }}
- Pace stream: {{ $json.streams.pace }}

RUNNING DYNAMICS (if available):
- Stride length: {{ $json.avg_stride_length }}m
- Vertical oscillation: {{ $json.avg_vertical_oscillation }}cm
- Ground contact time: {{ $json.avg_ground_contact_time }}ms

ANALYSIS INSTRUCTIONS:

1. EXECUTION CHECK:
   - Does activity type match plan?
   - Was intensity/duration appropriate?
   - If mismatch, logical swap or rogue activity?

2. POWER ANALYSIS (cycling/running with power):
   - Pacing appropriate for workout type?
   - Variability acceptable? (Easy: low VI, Intervals: high VI)
   - Power:HR decoupling? (fatigue indicator)

3. CADENCE ANALYSIS:
   - Cycling: 85-95rpm for endurance
   - Running: 170-180spm optimal
   - Consistency assessment

4. HEART RATE ANALYSIS:
   - Effort appropriate for zone targets?
   - HR drift over duration? (aerobic fitness indicator)
   - Recovery quality in intervals?

5. RUNNING FORM (if available):
   - Cadence efficiency
   - Stride length appropriate for pace
   - Vertical oscillation (target <9cm)
   - Ground contact time (shorter = better)
   - Form degradation over workout?

6. COACHING FEEDBACK:
   - Specific technical observations
   - Positive reinforcement
   - Actionable suggestions
   - Context from training phase

OUTPUT FORMAT:
6-8 sentences max. Professional coach tone. Data-driven but supportive.
Focus on 1-2 key technical insights. End with forward-looking guidance.

Example:
"Solid 90min Z2 ride! Power execution excellent - 245W avg (85% FTP),
normalized 258W, VI 1.05 shows steady pacing. Cadence rock-solid 90-94rpm
throughout. HR drift 148→156bpm (5.4%) over the session is normal for
sustained Z2, shows you're right at aerobic ceiling. Power:HR decoupling
only 3.2% - your aerobic base is strong. Perfect foundational work for
Build phase. Easy spin tomorrow to absorb the stimulus."
```

## Next Steps

1. **Get your credentials**:
   - Intervals.icu Athlete ID (from URL)
   - Intervals.icu API Key (Settings → Developer Settings)

2. **Answer the 5 questions above** so I know your preferences

3. **I'll build the workflow** using your actual athlete ID and data

4. **We test together** with a manual execution

5. **Activate and iterate** based on feedback quality

Ready to proceed? Share your Intervals.icu credentials and preferences!

---

**Sources:**
- [Intervals.icu API Documentation](https://www.intervals.icu/api-docs.html)
- [API Integration Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090)
- [Access Activities Streams via API](https://forum.intervals.icu/t/access-activities-streams-via-api/101065)
- [Download Activity Streams CSV](https://forum.intervals.icu/t/download-and-upload-activity-streams-csv/114377)
