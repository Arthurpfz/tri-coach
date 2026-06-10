/**
 * Lock the bullet count at 3 and force trend insights to be woven into an
 * existing bullet rather than appended as a 4th.
 */
require('dotenv').config({ path: '/Users/arthurpfalzgraf/Desktop/Projects/TRI COACH/.env' });
const axios = require('axios');
const n8n = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
});

const OLD_FORMAT = `=== ANALYSIS FORMAT ===
[sport-emoji] [Sport] · [duration]min · [distance]km · [avg HR]bpm · TSS [tss]
Grade: [A/B/C/F] — [one reason about session quality, ≤8 words]

• [insight 1 with a specific number, ideally trend or condition-aware]
• [insight 2 with a specific number]
• Limiter: [the one thing holding back progress]

Tomorrow: [session prescription ≤12 words]
Watch: [one metric to track next time ≤8 words]`;

const NEW_FORMAT = `=== ANALYSIS FORMAT (EXACTLY 3 BULLETS — no more, no less) ===
[sport-emoji] [Sport] · [duration]min · [distance]km · [avg HR]bpm · TSS [tss]
Grade: [A/B/C/F] — [one reason about session quality, ≤8 words]

• [insight 1 — the most important physiological/execution flag, with specific numbers]
• [insight 2 — secondary flag OR trend delta if material; weave the trend INTO this bullet, do NOT add a 4th]
• Limiter: [the one thing holding back progress]

Tomorrow: [session prescription ≤12 words]
Watch: [one metric to track next time ≤8 words]

If trend usage is required (rule above), fold the trend insight into bullet 1 OR bullet 2 — never as a separate bullet. Examples:
- "HR 149bpm — 9 below your 30d Ride avg of 158bpm, but 37% above Z2 ceiling: pacing control was the issue, not effort"
- "Cadence 68rpm — same low pattern as your 30d Ride avg, mechanically inefficient on flat terrain"

NEVER output more than 3 bullets. NEVER omit the Limiter bullet.`;

const FORMAT_RULES_OLD = `RULES (enforce strictly):
- NEVER prefix the message with "⚠️ Off-plan" or any plan-adherence warning. Header is just session info.
- NEVER use "off-plan", "deviated from plan", "no planned X today", or similar phrasing.
- Do NOT scold or moralize about the athlete deviating from the plan.
- Mention the plan only if it's genuinely useful context. Default to silence about the plan.
- Grade reasoning must reference session quality (zones, pacing, cadence, drift, decoupling), never plan adherence.
- When flagging mechanical/physiological issues, account for terrain (elevation_gain) and conditions (temp, wind).
- ZERO markdown — no **, no *, no __. Plain text only.
- Bullets are the literal • character.
- Max 8 lines total.`;

const FORMAT_RULES_NEW = `RULES (enforce strictly):
- NEVER prefix the message with "⚠️ Off-plan" or any plan-adherence warning. Header is just session info.
- NEVER use "off-plan", "deviated from plan", "no planned X today", or similar phrasing.
- Do NOT scold or moralize about the athlete deviating from the plan.
- Mention the plan only if it's genuinely useful context. Default to silence about the plan.
- Grade reasoning must reference session quality (zones, pacing, cadence, drift, decoupling), never plan adherence.
- When flagging mechanical/physiological issues, account for terrain (elevation_gain) and conditions (temp, wind).
- EXACTLY 3 bullets. The third bullet MUST start with "Limiter:". No 4th bullet under any circumstance.
- When the trend rule applies, the trend insight goes INSIDE bullet 1 or 2 — not as a separate bullet.
- ZERO markdown — no **, no *, no __. Plain text only.
- Bullets are the literal • character.
- Max 8 lines total (1 header + 1 grade + blank + 3 bullets + Tomorrow + Watch = 8).`;

function sanitize(wf) {
  return { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || {}, staticData: wf.staticData || null };
}

async function update(workflowId, label) {
  const { data: wf } = await n8n.get(`/workflows/${workflowId}`);
  const llm = wf.nodes.find(n => n.name === 'Hardcore Analysis');
  const before = llm.parameters.text;
  let after = before.replace(OLD_FORMAT, NEW_FORMAT);
  if (after === before) console.warn(`[${label}] WARN: format block not replaced`);
  after = after.replace(FORMAT_RULES_OLD, FORMAT_RULES_NEW);
  if (after === before) console.warn(`[${label}] WARN: rules block not replaced`);
  llm.parameters.text = after;
  console.log(`[${label}] ${before.length} → ${after.length} chars`);
  const { data: result } = await n8n.put(`/workflows/${workflowId}`, sanitize(wf));
  console.log(`[${label}] PUT ok. versionId: ${result.versionId}`);
}

(async () => {
  try {
    await update('hrSGUqoAwkWQ4gKl', 'Daily Checkin');
    await update('rHIyZMIJNAOqZvM2', 'Backfill /refresh');
    console.log('Done.');
  } catch (e) {
    console.error(e.response?.data || e.message);
    process.exit(1);
  }
})();
