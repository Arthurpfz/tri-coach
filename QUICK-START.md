# Quick Start - Intervals.icu Workflow Import

## 5-Minute Setup Guide

### 1. Airtable (2 min)
Add 3 columns to Users table:
- `Intervals.icu Athlete ID` → `i492254`
- `Intervals.icu API Key` → `INTERVALS_API_KEY_REDACTED`
- `Intervals.icu Last Sync` → leave empty

### 2. N8N Credential (1 min)
Settings → Credentials → Add → HTTP Basic Auth:
- Name: `Intervals.icu API`
- Username: `API_KEY` (literally this text)
- Password: `INTERVALS_API_KEY_REDACTED`

### 3. Import Workflow (1 min)
Workflows → Add → Import from File:
- Upload: `intervals-icu-workflow.json`

### 4. Connect Credential (30 sec)
- Click "Get Activities" node
- Select "Intervals.icu API" credential
- Save

### 5. Test (30 sec)
- Click "Execute Workflow"
- Wait for Telegram message
- Should see technical analysis!

### 6. Activate (10 sec)
- Toggle switch ON (top right)
- Done! Runs daily at 20:10

---

## What You'll Get

**Before (Strava only):**
> "Strong run! 10km in 64min, HR in Z2. Good work."

**After (+ Intervals.icu):**
> "Solid 64min run with 250W avg power. Cadence 149spm is low - aim for 170-180spm for efficiency. HR 163bpm suggests pace too fast for Z2 work. TSS 85 appropriate but lower intensity needed. Slow down next easy run to <155bpm. Recovery tomorrow well-timed."

---

## Troubleshooting

**No message received?**
1. Check execution logs in N8N
2. Verify Airtable fields exist
3. Test API: `node test-intervals-icu.js`

**Wrong credential error?**
- Username must be exactly: `API_KEY`
- Password is your actual key

**No activities found?**
- Workflow only analyzes non-Strava activities
- COROS must sync directly to Intervals.icu

---

## Full Details
See `IMPORT-INSTRUCTIONS.md` for step-by-step with screenshots and troubleshooting.
