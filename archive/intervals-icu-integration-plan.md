# Intervals.icu Integration Plan

## Project Goal
Create a new daily check-in workflow that uses Intervals.icu data instead of Strava. This will provide access to FIT file data for detailed technical analysis including:
- Power metrics (average, normalized, variability)
- Cadence (running & cycling)
- Heart rate variability
- Running dynamics (stride length, vertical oscillation, ground contact time)
- Swimming metrics (stroke rate, SWOLF, efficiency)
- Form and technique indicators

## Research Summary

### API Documentation
- **Official Docs**: [Intervals.icu API docs](https://www.intervals.icu/api-docs.html)
- **Swagger UI**: [Interactive API Explorer](https://intervals.icu/api/v1/docs/swagger-ui/index.html)
- **Forum Guide**: [API Integration Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090)
- **Streams Access**: [Activities Streams via API](https://forum.intervals.icu/t/access-activities-streams-via-api/101065)

### Authentication
- **Method**: HTTP Basic Authentication
- **Username**: `API_KEY` (literal string)
- **Password**: Your personal API key
- **Where to get**: Settings → Developer Settings (bottom of page)

**Example:**
```bash
curl -u API_KEY:your_api_key_here https://intervals.icu/api/v1/athlete/i12345/activities
```

### Key Endpoints

#### 1. Get Activities
```
GET /api/v1/athlete/{athleteId}/activities
```
- Returns list of activities with summary data
- Can filter by date range
- Includes: duration, distance, TSS, IF, NP, avg power, avg HR, etc.

#### 2. Get Activity Detail
```
GET /api/v1/activity/{activityId}
```
- Returns detailed activity with all computed metrics
- Includes: intervals, laps, zones, streams_types array

#### 3. Get Activity Streams (NEW!)
```
GET /api/v1/activity/{activityId}/streams.csv
POST /api/v1/activity/{activityId}/streams (JSON format)
```
- Returns time-series data: watts, heartrate, cadence, pace, altitude, etc.
- This is the goldmine for technical analysis!

### Available Data Points

**From Activity Summary:**
- Basic: type, name, start_date, moving_time, distance
- Power: avg_watts, weighted_avg_watts, np (normalized power), variability_index
- Heart Rate: avg_hr, max_hr, hrr (heart rate reserve)
- Training Load: training_load (TSS), intensity (IF)
- Pace/Speed: avg_speed, pace
- Cadence: avg_cadence, avg_run_cadence
- Swimming: avg_stroke_rate, swolf

**From Activity Streams (time-series):**
- watts (power)
- heartrate
- cadence
- run_cadence
- pace
- speed
- altitude
- stride_length (running)
- vertical_oscillation (running)
- ground_contact_time (running)
- core_temp (if device supports)

## Workflow Design

### New Workflow: "Coach Tri - Daily Checkin (Intervals.icu)"

**Flow:**
1. **Schedule Trigger** - Daily at 20:10 (5 min after Strava version)
2. **Search Users** - Fetch users from Airtable
3. **Loop Over Users** - Process each athlete
4. **HTTP Request** - Get today's activities from Intervals.icu
   ```
   GET https://intervals.icu/api/v1/athlete/{athleteId}/activities
   Query: oldest={today_start}&newest={today_end}
   Auth: Basic (API_KEY / {api_key})
   ```
5. **Check Activities** - If activities exist
6. **Loop Over Activities** - Process each activity
7. **HTTP Request** - Get detailed activity data + streams
   ```
   GET https://intervals.icu/api/v1/activity/{activityId}
   ```
8. **Calculate Monday** - Determine current week
9. **Search Plan** - Fetch weekly plan from Airtable
10. **Enhanced LLM Chain** - Claude analyzes with technical depth
    - Plan vs Actuals comparison (existing logic)
    - NEW: Power analysis (pacing, variability)
    - NEW: Cadence analysis (efficiency)
    - NEW: HR analysis (effort appropriateness)
    - NEW: Form metrics (technique quality)
11. **Send Message** - Telegram with technical insights

### Airtable Schema Updates

**Users Table - Add Fields:**
```
- Intervals.icu Athlete ID (string)
- Intervals.icu API Key (string)
- Intervals.icu Last Sync (number): Unix timestamp
```

**Optional: Activities Table (for historical tracking)**
```
- Activity ID (string): Intervals.icu activity ID
- Athlete (linked record): Link to Users
- Date (date)
- Type (string): Run, Ride, Swim, etc.
- Duration (number): seconds
- Distance (number): meters
- TSS (number)
- Average Power (number)
- Normalized Power (number)
- Average HR (number)
- Average Cadence (number)
- Technical Notes (long text): AI-generated insights
- Raw Data (long text): JSON dump for reference
```

## Enhanced Claude Prompt

The new prompt will analyze:

### 1. Basic Execution (Existing)
- Activity type matches plan
- Duration/distance appropriate
- Logical swaps or rogue activities

### 2. Power Analysis (NEW - for cycling/running with power)
```
- Was pacing appropriate for session type?
  - Easy sessions: Below FTP threshold, low variability
  - Tempo: Sustained within target range
  - Intervals: Clean execution, good recovery
- Variability Index: Too erratic? Too steady?
- Decoupling: Power dropping while HR rising? (fatigue indicator)
```

### 3. Cadence Analysis (NEW)
```
- Cycling: 85-95 rpm target for endurance
- Running: Appropriate for pace and terrain
- Consistency: Stable or erratic?
```

### 4. Heart Rate Analysis (NEW)
```
- Effort appropriate for session type?
- HR drift: Rising HR while power/pace stable? (heat/fatigue)
- Recovery quality: HR dropping quickly in rest intervals?
- Zone distribution: Time in Z2 vs Z3+ appropriate?
```

### 5. Swimming Metrics (NEW)
```
- Stroke rate: Appropriate for pace
- SWOLF score: Improving or degrading?
- Efficiency: Distance per stroke
```

### 6. Running Dynamics (NEW - if available)
```
- Cadence: Target 170-180 spm for most athletes
- Stride length: Appropriate for pace
- Vertical oscillation: Lower is generally better
- Ground contact time: Shorter for faster paces
```

## Implementation Steps

### Phase 1: Setup & Configuration
1. [ ] Get Intervals.icu API key from settings
2. [ ] Find your athlete ID (visible in URL when logged in)
3. [ ] Update Airtable Users table with new fields
4. [ ] Add your Intervals.icu credentials to Airtable

### Phase 2: Build Workflow
1. [ ] Duplicate "Coach Tri - Daily Checkin" workflow
2. [ ] Rename to "Coach Tri - Daily Checkin (Intervals.icu)"
3. [ ] Remove Strava-specific nodes
4. [ ] Add Intervals.icu API authentication
5. [ ] Add "Get Activities" HTTP request
6. [ ] Add "Get Activity Details" HTTP request
7. [ ] Update the Claude prompt for technical analysis
8. [ ] Test with manual execution

### Phase 3: Enhanced Prompts
1. [ ] Design comprehensive technical analysis prompt
2. [ ] Create prompt variations for different activity types:
   - Running with power
   - Cycling (indoor vs outdoor)
   - Swimming
   - Multi-sport
3. [ ] Test prompt outputs with sample data

### Phase 4: Testing & Refinement
1. [ ] Test with various activity types
2. [ ] Validate Claude's technical insights
3. [ ] Refine feedback quality
4. [ ] Adjust Telegram message length/format
5. [ ] Schedule activation

### Phase 5: Optimization
1. [ ] Consider caching activity data in Airtable
2. [ ] Add error handling for missing streams
3. [ ] Create fallback for activities without power/HR
4. [ ] Add weekly summary reports

## Questions to Answer

1. **Do you want to keep both workflows running?**
   - Strava: Basic activity tracking (simpler, proven)
   - Intervals.icu: Advanced technical analysis

2. **What time should this run?**
   - Suggestion: 20:10 (5 min after Strava to avoid overlap)

3. **Should we save activity data to Airtable?**
   - Pro: Historical tracking, trend analysis
   - Con: More complexity, storage

4. **Telegram message length?**
   - Keep 4 sentences (concise)
   - Or expand to 6-8 sentences for technical depth?

5. **Which technical metrics matter most to you?**
   - Power analysis (pacing, variability)
   - Cadence patterns
   - HR drift/decoupling
   - Running dynamics
   - All of the above?

## Example Enhanced Feedback

**Before (Strava only):**
```
Strong run this morning! Nailed the easy pace at 5:30/km, HR stayed in Z2
(140bpm avg). Form is building nicely. Rest day tomorrow.
```

**After (Intervals.icu with FIT data):**
```
Solid easy run! Pace 5:30/km in Z2 (138bpm), cadence consistent at 178spm.
Power decoupling only 2.8% - excellent aerobic efficiency. Stride length stable
throughout (1.25m), suggesting good form even when fatigued. Vertical oscillation
8.2cm (target <9cm) shows efficient mechanics. Great aerobic foundation session.
```

## Next Steps

1. Confirm your interest in this approach
2. Get your Intervals.icu API key and Athlete ID
3. Decide on questions above
4. I'll build the workflow for you

---

*References:*
- [Intervals.icu API Documentation](https://www.intervals.icu/api-docs.html)
- [API Integration Cookbook](https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090)
- [Access Activities Streams via API](https://forum.intervals.icu/t/access-activities-streams-via-api/101065)
