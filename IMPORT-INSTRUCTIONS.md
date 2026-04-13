# Import Instructions - Intervals.icu Daily Check-in Workflow

## Overview
This workflow will analyze your COROS/Wahoo activities from Intervals.icu with deep technical insights including power, TSS, intervals, and more.

**Schedule**: Daily at 20:10 (5 minutes after your Strava workflow)

---

## STEP 1: Update Airtable Schema (5 minutes)

### Add New Columns to Users Table

1. Go to your Airtable base: https://airtable.com/appw0Xd3T54okfaXa
2. Open the **Users** table
3. Add these new fields:

| Field Name | Field Type | Notes |
|------------|------------|-------|
| `Intervals.icu Athlete ID` | Single line text | Your athlete ID (i492254) |
| `Intervals.icu API Key` | Single line text | Your API key |
| `Intervals.icu Last Sync` | Number | Optional - for future use |

4. **Add your data** to the Arthur Pfalzgraf row:
   - Intervals.icu Athlete ID: `i492254`
   - Intervals.icu API Key: `INTERVALS_API_KEY_REDACTED`

✅ **Checkpoint**: Your Users table should now have these new columns filled in.

---

## STEP 2: Create API Credential in N8N (2 minutes)

1. Go to N8N: https://apfz.app.n8n.cloud
2. Click your **profile icon** (top right) → **Settings**
3. Go to **Credentials** in the left sidebar
4. Click **Add Credential**
5. Search for **HTTP Basic Auth**
6. Fill in:
   - **Name**: `Intervals.icu API`
   - **Username**: `API_KEY` (exactly as written - this is literal, not your key!)
   - **Password**: `INTERVALS_API_KEY_REDACTED` (your actual API key)
7. Click **Save**

✅ **Checkpoint**: You should see "Intervals.icu API" in your credentials list.

---

## STEP 3: Import the Workflow (2 minutes)

1. In N8N, click **Workflows** (left sidebar)
2. Click **Add workflow** (top right) → **Import from File**
3. Upload the file: `intervals-icu-workflow.json`
4. The workflow will appear with the name: **Coach Tri - Daily Checkin (Intervals.icu)**

✅ **Checkpoint**: You should see the workflow canvas with all nodes connected.

---

## STEP 4: Connect the HTTP Basic Auth Credential (1 minute)

The "Get Activities" node needs to be linked to your credential:

1. Click on the **"Get Activities"** node
2. Under **Credentials**, find **HTTP Basic Auth**
3. Select **Intervals.icu API** from the dropdown
4. Click **Save** (bottom right)

✅ **Checkpoint**: The "Get Activities" node should show a green checkmark on the credential field.

---

## STEP 5: Verify Other Credentials (1 minute)

Make sure all other nodes have credentials connected:

### Check These Nodes:
- **Search Users** → Should use: "Airtable Personal Access Token account"
- **Search Plan** → Should use: "Airtable Personal Access Token account"
- **OpenRouter Chat Model** → Should use: "OpenRouter account"
- **Send Telegram Message** → Should use: "Telegram account"

If any are missing, select them from the dropdown in each node.

✅ **Checkpoint**: All nodes should show credentials connected (no red warning icons).

---

## STEP 6: Test the Workflow (5 minutes)

### Manual Test Execution

1. Click **Execute Workflow** button (play icon, top right)
2. Wait for execution to complete (~10-15 seconds)
3. Check the results:

**Expected Flow:**
```
Schedule Trigger → Search Users → Loop Over Users →
Get Activities (should find today's activities) →
Check Activities → Loop Over Activities →
Filter Out Strava → Calculate Monday → Search Plan →
Technical Analysis (Claude analyzes) →
Send Telegram (you get a message!)
```

### Troubleshooting

**If "Get Activities" node fails:**
- Check that HTTP Basic Auth credential is correctly set
- Verify username is exactly `API_KEY` (not your athlete ID)
- Verify password is your actual API key

**If "Search Users" fails:**
- Make sure you added the Intervals.icu columns to Airtable
- Check field names match exactly (including spaces)

**If "Search Plan" returns empty:**
- Make sure you have a weekly plan for this week in Airtable
- Check the Monday_date calculation is correct

**If no Telegram message:**
- Check Telegram credentials are connected
- Verify chat ID is correct (TELEGRAM_CHAT_ID_REDACTED)

✅ **Checkpoint**: You should receive a Telegram message with technical analysis!

---

## STEP 7: Review the Output

Your Telegram message should include:

- ✅ Activity matched against today's plan
- ✅ Power analysis (if available)
- ✅ TSS and training load assessment
- ✅ Heart rate response
- ✅ Cadence analysis
- ✅ Interval execution (if detected)
- ✅ Technical coaching feedback
- ✅ Forward-looking guidance

**Example Output:**
```
Solid 64min easy run! Pace 6:06/km with consistent power averaging
~250W. Cadence 149spm is on the lower end - aim for 170-180spm for
better efficiency. HR averaged 163bpm (Z3) which is higher than planned
Z2 - either pace was too fast or you're carrying fatigue. TSS of 85 is
appropriate. Consider slowing down next easy run to true Z2 (<155bpm).
Recovery day tomorrow is well-timed.
```

---

## STEP 8: Activate the Workflow (30 seconds)

1. Click the **toggle switch** at the top (currently OFF/grey)
2. It should turn **green** and show "Active"
3. The workflow will now run automatically every day at 20:10

✅ **Final Checkpoint**: Workflow is active and will run daily!

---

## What Happens Now?

### Daily at 20:10 (Europe/Berlin time):
1. Workflow fetches today's activities from Intervals.icu
2. Filters out Strava-synced activities (only analyzes direct uploads)
3. Gets your weekly training plan
4. Claude analyzes execution vs plan + technical metrics
5. Sends detailed coaching feedback via Telegram

### What Gets Analyzed:
- **Execution**: Did you follow the plan?
- **Power**: Pacing, variability, distribution (running & cycling)
- **TSS**: Training load appropriate?
- **Heart Rate**: Effort zones, drift, decoupling
- **Cadence**: Efficiency indicators
- **Intervals**: Structure execution, recovery quality
- **Technical**: 1-2 key insights with actionable feedback

---

## Comparison: Strava vs Intervals.icu Workflows

### Strava Workflow (20:05)
- Basic activity tracking
- Simple execution feedback
- 4 sentences max

### Intervals.icu Workflow (20:10)
- Deep technical analysis
- Power/TSS/interval insights
- 6-8 sentences with specific metrics

Both run in parallel - you get **two perspectives** each evening!

---

## Maintenance

### If You Get No Message:
1. Check execution history in N8N
2. Look for error nodes (red icons)
3. Common fixes:
   - Verify Airtable fields exist
   - Check API credentials haven't expired
   - Ensure weekly plan exists for current week

### To Adjust the Prompt:
1. Open workflow in N8N
2. Click **"Technical Analysis"** node
3. Edit the prompt text
4. Click **Save**
5. Test with **Execute Workflow**

---

## Future Enhancements

### Coming Soon:
- [ ] Weekly summary reports (trend analysis)
- [ ] Historical activity storage in Airtable
- [ ] Power:HR decoupling tracking
- [ ] Form metrics trending
- [ ] Multi-device sensor fusion

---

## Support

If you encounter issues:

1. **Check Execution Logs**:
   - N8N → Executions tab → Click failed execution
   - Look for error message and node

2. **Test Individual Nodes**:
   - Click "Execute Workflow" from specific node
   - This helps isolate the problem

3. **Verify Data**:
   ```bash
   node test-intervals-icu.js  # Test API connection
   node check-versions.js      # Check N8N workflow versions
   ```

4. **Common Issues**:
   - Missing Airtable fields
   - Wrong credential IDs
   - API key expired
   - No weekly plan for current week

---

## Success! 🎉

You now have:
- ✅ Strava workflow (basic tracking)
- ✅ Intervals.icu workflow (deep analysis)
- ✅ Dual daily feedback (20:05 and 20:10)
- ✅ Power, TSS, and interval insights
- ✅ Technical coaching from FIT file data

**Next execution**: Tonight at 20:10!

Enjoy your enhanced coaching feedback! 🚴‍♂️🏃‍♂️🏊‍♂️
