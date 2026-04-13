# Intervals.icu Data Summary for Arthur

## API Connection Status
✅ **WORKING** - Successfully connected to athlete i492254

## Data Sources
- **COROS PACE 3**: Swim & Run activities with full FIT files
- **ZEPP (Amazfit)**: Workout activities
- **Last 30 days**: 59 direct-upload activities (not via Strava)

## Available Metrics by Activity Type

### Swimming (COROS PACE 3)
**Summary Metrics:**
- Distance: 2.02 km
- Duration: 44 min (moving time: 2,633s)
- Avg HR: 126 bpm, Max HR: 158 bpm
- Avg Cadence: 22.5 strokes per minute
- Avg Speed: 0.781 m/s (2:08/100m pace)
- TSS: 23
- Avg Temperature: 26°C
- Interval Structure: "1x 425m 102bpm, 7x 200m 131bpm, 1x 150m 135bpm, 1x 50m 141bpm"

**Time-Series Streams:**
- time
- cadence (stroke rate)
- heartrate
- distance
- velocity_smooth
- temp

**HR Zone Distribution:**
- Z1: 2,613s (most time)
- Z2: 17s
- Z3: 12s
- Z4-Z7: 0s

### Running (COROS PACE 3)
**Summary Metrics:**
- Distance: 10.56 km
- Duration: 64 min
- Avg Speed: 2.75 m/s (6:06 min/km)
- Avg HR: 163 bpm, Max HR: 186 bpm
- **Avg Cadence: 149 spm** (steps per minute - already doubled by device)
- **Avg Power: Available** (in watts stream)
- TSS: 85

**Time-Series Streams:**
- time
- **watts** ✅ (running power!)
- cadence
- heartrate
- distance
- altitude
- latlng (GPS)
- velocity_smooth
- torque
- fixed_altitude

**Running Dynamics:**
- ❌ Vertical Oscillation: Not in streams
- ❌ Stride Length: Not in streams
- ❌ Ground Contact Time: Not in streams
- ❌ Stance Time: Not in streams

**Note**: COROS PACE 3 provides running power but may not export advanced dynamics to Intervals.icu API. These metrics might be visible in COROS app but not accessible via API.

### Cycling (Expected - no recent sample)
**Likely Available from Wahoo ELEMNT:**
- Power (watts, normalized power, variability)
- Cadence
- Heart rate
- Speed
- Altitude/elevation

## What This Means for Coaching Analysis

### ✅ What We CAN Analyze

**Swimming:**
- Stroke rate consistency
- Pace per 100m
- HR response to intervals
- Interval execution (did you hit targets?)
- Efficiency (speed vs effort)
- Time in zones

**Running:**
- **Running power analysis** 🎉
  - Pacing consistency
  - Power vs HR (efficiency)
  - Uphill/downhill power distribution
  - Power variability
- Cadence patterns
- HR drift (aerobic fitness indicator)
- Pace execution
- Elevation/altitude impact
- TSS and training load

**Cycling:**
- Full power analysis (when available)
- Cadence consistency
- Power:HR decoupling
- Normalized power & VI
- TSS and IF

### ❌ What We CANNOT Analyze (Yet)
- Running form metrics (vertical oscillation, stride length, ground contact)
- These may be in COROS app but not exported to Intervals.icu API
- Alternative: Could potentially add COROS API integration later

## Intervals.icu Advantages Over Strava

1. ✅ **Full FIT File Preservation**
   - Strava strips detailed streams
   - Intervals.icu keeps everything

2. ✅ **Running Power Data**
   - Not available via Strava API
   - Available in Intervals.icu from COROS

3. ✅ **Training Load (TSS)**
   - Calculated automatically
   - Strava requires premium for similar

4. ✅ **Interval Detection**
   - Auto-detects workout structure
   - "1x 425m, 7x 200m" format

5. ✅ **No OAuth Complexity**
   - Simple API key authentication
   - No token refresh required

## Recommendation: Hybrid Approach

**Keep Both Workflows:**
1. **Strava Workflow (20:05)**: Simple activity tracking, social features
2. **Intervals.icu Workflow (20:10)**: Deep technical analysis with power/TSS

**Benefits:**
- Redundancy: If one fails, the other still works
- Different insights: Strava for basics, Intervals.icu for depth
- Minimal overlap: 5-minute delay prevents conflicts

## Next Steps

1. ✅ API connection tested and working
2. ✅ Data structure understood
3. ⏳ Update Airtable schema (add Intervals.icu fields to Users table)
4. ⏳ Build N8N workflow
5. ⏳ Create enhanced Claude prompts
6. ⏳ Test with real data
7. ⏳ Activate workflow

Ready to proceed with building the workflow!
