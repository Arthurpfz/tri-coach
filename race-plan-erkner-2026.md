# Race Plan — Erkner 70.3 · 2026-09-13

Locked 2026-08-29, two weeks out. Built from live `/progress` data (CTL 23, last 4wk:
0 rides, 1 OW swim, 5 runs @ 6:43/km avg), not the stale July profile. The badly
recorded OW swim (3:07/100m, DPS 1.01 — GPS under-read) is discounted; swim targets
derive from the prior block's pool 2:03/100m and OW 2:18/100m.

**Finish target: ~6:00** (great day 5:50 · hard day 6:15).

| Leg | Target | Split | Cumulative |
|---|---|---|---|
| Swim 1.9km | 2:20/100m | 0:44 | 0:44 |
| T1 | — | 0:05 | 0:49 |
| Bike 90km | 175–185W · ~30 km/h | 3:00 | 3:49 |
| T2 | — | 0:03 | 3:52 |
| Run 21.1km | 6:10 → 5:55/km ladder | 2:07 | **5:59** |

## 🏊 Swim — 1.9km · 44 min
- Pace **2:20/100m** (2:15 only if it genuinely feels easy). Old 1:58 target is void.
- First 200m deliberately slow — let the start wash out, find feet, draft.
- Breathe every 3 strokes comfortably; long strokes, glide (DPS) is the strength.
- Last 200m: add kick to wake the legs for T1.

## 🚴 Bike — 90km · 3:00 · avg 175–185W
**Hard ceiling 200W — never above, not on rises, not overtaking. HR cap 145 bpm.**

| Segment | Power | Notes |
|---|---|---|
| km 0–10 | 170W | HR still swim-high; let it settle under 140 |
| km 10–60 | 180–185W | The engine room — this is the race |
| km 60–80 | 175–180W | Long rides decoupled 12.5% when trained — expect drift, respect HR ≤145 |
| km 80–90 | 165–170W, 90+ rpm | Spin loose, prep the run |

- **Nutrition is a bike target: 60–80g carbs + 500–750ml fluid per hour from km 10.**
  20-min alarm. No riding in a month → gut needs the drip-feed, not two gels at km 70.
- If HR won't hold under 145 at 180W, the watts lie — follow HR down, not power up.

## 🏃 Run — 21.1km · 2:05–2:08
- km 0–5: **6:10/km**, HR ≤150 — feels insultingly slow off the bike; hold it anyway.
- km 5–15: **5:55–6:00/km**.
- km 15–21.1: free — race with whatever is left.
- Walk every aid station (~20 steps), drink; cola from km 12 if available.

**Pending validation (pre-taper weekend):** 70-min run, final 25 min @ 5:50/km.
Pass = HR ≤160 and stable → ladder above stands. Fail → shift ladder +15s/km
(6:25 → 6:10), finish ~6:10–6:15 instead of detonating at km 14.

## The two numbers on your hand
**185** (bike watts) and **6:10** (run pace, first 5k). Every negotiation won against
these early is lost double after run km 15. 185W feels like being passed for three
hours; the payback window is run km 10–21.

## Deploying to the coach
Run `./update-race-goal.sh` locally (needs `.env` with `TRICOACH_API_KEY`) to write
these targets into the athlete `goal` field, so the Sunday Planner race-week module
(`racePrep`, W≤1) generates its `race_plan` from current reality instead of the
stale 1:58/100m-era targets.
