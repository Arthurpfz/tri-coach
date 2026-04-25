# tri-coach

An AI triathlon coach I built for myself. Analyses every workout I do, grades it against the week's plan, and texts me feedback. Generates the next week's plan every Sunday. Runs entirely on my own infrastructure.

This is the system that's coaching me toward an Ironman. Sharing the source because it's a clean illustration of what you can do with n8n + Claude + a few APIs and a weekend.

```
                ┌──────────────────────────────────────────┐
                │  Sunday 20:07 — Sunday Planner workflow  │
                │  Claude 3.7 Sonnet generates next week   │
                │  → tricoach-db (POST /weekly-plans)      │
                │  → Telegram (the plan)                   │
                └──────────────────────────────────────────┘

                ┌──────────────────────────────────────────┐
                │  Daily 20:10 — Daily Check-in workflow   │
                │                                          │
                │  Intervals.icu  ──┐                      │
                │   (today's FIT)   │                      │
                │                   ▼                      │
                │  weekly plan ─→ Claude 3.7 (analysis)    │
                │  (tricoach-db)    │                      │
                │                   ▼                      │
                │  tricoach-db (POST /sessions, PATCH)     │
                │  Telegram (6-line coach feedback)        │
                └──────────────────────────────────────────┘

                ┌──────────────────────────────────────────┐
                │  Daily 20:30 — Weekly Stats workflow     │
                │  Aggregate week-to-date hours per sport  │
                │  → Telegram (🔥 per training hour)       │
                └──────────────────────────────────────────┘

                ┌──────────────────────────────────────────┐
                │  Error Handler workflow                  │
                │  Any failure above → Telegram alert      │
                └──────────────────────────────────────────┘
```

## What it actually does

**Sunday night:** generates next week's training plan using my fitness profile (HR zones, paces, FTP, CSS), current training phase (Base / Build / Peak / Taper), race date, and the personal constraints I refuse to negotiate on (e.g. "no key sessions on Friday"). Each session is labelled `KEY`, `OPTIONAL (Easy)`, `OPTIONAL (Intensity)` or `REST` so I always know what's skippable.

**Every weekday at 20:10:** pulls today's activities from Intervals.icu, fetches today's planned session, and asks Claude to grade execution. Output is intentionally short — six lines designed to fit on one Telegram screen, no markdown:

```
🏃 50 min Z2 Run · Grade: A
• Power 245W avg (85% FTP), NP 258W, VI 1.05 — textbook
  steady pacing
• Cardiac drift only 5.2% — aerobic ceiling rising
• Cadence 90-94 rpm <3% variation, clean
Tomorrow: easy spin
Watch: last 20min saw 8W power drop while HR held —
glycogen depletion flag
```

**Every day at 20:30:** sends a one-message summary of week-to-date training hours, broken down by sport, with one 🔥 per hour. Closes the loop on whether I'm hitting volume.

**Rest days, swaps, off-plan workouts:** the prompt explicitly handles all three. It checks for direct match, then logical swap (did I move tomorrow's session to today?), then "rogue" (did I do something not in the plan?), then missed session. Tone is "coach", not "robot" — short, supportive, no fluff.

## Stack

| Layer | Tech |
|---|---|
| Orchestration | [n8n](https://n8n.io) (cloud) — 4 workflows |
| LLM | Claude 3.7 Sonnet via [OpenRouter](https://openrouter.ai) |
| Training data | [Intervals.icu](https://intervals.icu) API (full FIT-file metrics) |
| Strava | Legacy fallback workflow (still active for completeness) |
| Storage | [tricoach-db](https://github.com/Arthurpfz/tricoach-db) — self-hosted SQLite REST API |
| Notifications | Telegram bot |

`tricoach-db` is its own repo because it's reusable and unrelated to triathlon. It's a tiny Express + SQLite service that holds athlete profile, weekly plans, and ~45 columns of session metrics per workout.

## Why Intervals.icu and not Strava?

Strava's API works fine but exposes very little. Intervals.icu ingests the same FIT files and gives back the full set: normalised power, variability index, cardiac drift, efficiency factor, decoupling, polarisation index, ATL/CTL, time-in-zone, interval auto-detection — everything a coach actually wants to see. The Strava workflow stays as a fallback but the analysis quality lives or dies on Intervals.

One catch: Intervals' API blocks activities that came in via Strava. So the upload chain has to be device → Intervals (direct), not device → Strava → Intervals.

## Why a self-hosted SQLite API and not Airtable / Postgres?

The original version used Airtable. Two problems killed it: the PAT got blocked at the account level (workflows started silently failing), and $30/month for ~16 rows is silly. Postgres + a managed host would also be silly for a single-athlete, single-writer workload. SQLite + Express in a Docker container on an existing VPS gets the job done in ~250 lines, zero recurring cost. Full write-up in [tricoach-db](https://github.com/Arthurpfz/tricoach-db).

## Repo layout

```
db/                         # SQLite REST API (mirror of github.com/Arthurpfz/tricoach-db)
workflow-daily-checkin.json     # n8n export — Strava check-in (legacy)
intervals-icu-workflow.json     # n8n export — Intervals.icu check-in (primary)
workflow-sunday-planner.json    # n8n export — weekly plan generation
sandbox-daily-checkin-v2.json   # historical experiments
*.js                        # one-off deploy/debug helpers I wrote during development
```

## Status

Production for me. Running every day since early 2026. Not packaged as a turnkey product — you'd need to bring your own n8n instance, OpenRouter key, Intervals.icu account, Telegram bot, and update the prompts to match your fitness profile.

If you want to actually run it, the workflow JSONs are importable into n8n cloud or self-hosted; pair them with [tricoach-db](https://github.com/Arthurpfz/tricoach-db) for the data layer.

## Design philosophy

A few decisions that paid off:

- **Flexible-by-default scheduling.** Every session is labelled `KEY` (do not skip) or `OPTIONAL`. Life happens; the system handles it without guilt-tripping.
- **Constraints are non-negotiable.** "No intensity day before a key session" and "max one optional intensity per week" are encoded in the prompt, not left for the model to forget.
- **Idempotency over retries.** A `Last Coaching Date` gate at the top of the daily workflow prevents double-coaching on accidental re-runs. Date is written *before* the heavy lifting, so even a downstream failure keeps the gate honest.
- **One source of truth.** All athlete config and plan data lives in tricoach-db. The workflows don't keep state of their own.
- **Telegram-native output.** Six lines. No markdown. Sport emoji + grade + three bullets + tomorrow + one watch-out. Designed to be readable on a watch face if needed.

## License

MIT.
