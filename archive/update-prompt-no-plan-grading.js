/**
 * update-prompt-no-plan-grading.js
 *
 * Decouples daily session analysis from the weekly plan.
 * Grade now reflects SESSION QUALITY (zones held, pacing, cadence, drift)
 * vs the athlete's fitness profile — NOT plan adherence.
 *
 * Updates:
 *   - hrSGUqoAwkWQ4gKl  Coach Tri - Daily Checkin (Intervals.icu)
 *   - rHIyZMIJNAOqZvM2  Coach Tri - Backfill (/refresh)
 *
 * Both share an identical "Hardcore Analysis" llm-chain node. Only `parameters.text`
 * is replaced; node ids, connections, and JSON output schema stay intact so
 * Parse Grade → Save Analysis → Send Telegram plumbing still works.
 *
 * Drafts must be activated manually in n8n UI after running.
 */
require('dotenv').config({ path: '/Users/arthurpfalzgraf/Desktop/Projects/TRI COACH/.env' });
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
});

const NEW_PROMPT = `=You are an elite endurance coach analyzing a single training session.

GRADE REFLECTS SESSION QUALITY ONLY — how cleanly this session of its kind was executed against the athlete's fitness profile (HR zones, FTP, CSS, cadence targets). It is NOT a plan-adherence score. An unplanned long ride executed cleanly is an A. A sloppy planned interval set is a C.

=== ATHLETE ===
- Name: {{ $('Loop Over Users').item.json.Name }}
- Phase: {{ $('Loop Over Users').item.json['Training Phase'] }}
- Profile: {{ $('Loop Over Users').item.json['Fitness Profile'] }}

=== THIS WEEK'S PLAN (indicative — not a contract) ===
Focus: {{ $('Search Plan').item.json.Focus }}
Sessions:
{{ JSON.stringify($('Search Plan').item.json.sessions || [], null, 2) }}

The plan is a Sunday suggestion. The athlete is free to swap, skip, or add sessions. Do NOT grade against it. Use it only as soft context if a meaningful relationship exists (e.g. swapped a planned swim for a ride). Be neutral.

=== ALREADY MATCHED THIS WEEK ===
{{ (($('Get Matched Sessions').item.json.sessions || []).filter(s => s.plan_session_id).map(s => '- plan_session_id=' + s.plan_session_id + ' (' + (s.sport||'?') + ', ' + (s.date||'') + ')').join('\\n')) || '(none yet)' }}

=== TODAY'S ACTIVITY ===
Activity: {{ $('Get Activity Details').item.json.type }} - {{ $('Get Activity Details').item.json.name }}
Source: {{ $('Get Activity Details').item.json.source }}
Duration: {{ Math.round($('Get Activity Details').item.json.moving_time / 60) }}min
Distance: {{ $('Get Activity Details').item.json.distance ? ($('Get Activity Details').item.json.distance / 1000).toFixed(2) + 'km' : 'N/A' }}

{{ $('Get Activity Details').item.json.avg_watts ? 'Power: ' + Math.round($('Get Activity Details').item.json.avg_watts) + 'W avg / ' + Math.round($('Get Activity Details').item.json.weighted_avg_watts) + 'W NP / VI ' + $('Get Activity Details').item.json.variability_index.toFixed(2) : '' }}
{{ $('Get Activity Details').item.json.average_heartrate ? 'HR: ' + Math.round($('Get Activity Details').item.json.average_heartrate) + 'bpm avg / ' + Math.round($('Get Activity Details').item.json.max_heartrate) + 'bpm max / LTHR ' + $('Get Activity Details').item.json.lthr : '' }}
{{ $('Get Activity Details').item.json.icu_hr_zone_times ? 'HR zones (Z1-Z5+): ' + $('Get Activity Details').item.json.icu_hr_zone_times.map(t => Math.round(t/60) + 'min').join(' / ') : '' }}
{{ $('Get Activity Details').item.json.average_cadence || $('Get Activity Details').item.json.avg_run_cadence ? 'Cadence: ' + Math.round(($('Get Activity Details').item.json.average_cadence || $('Get Activity Details').item.json.avg_run_cadence) * ($('Get Activity Details').item.json.type === 'Run' ? 2 : 1)) + ($('Get Activity Details').item.json.type === 'Run' ? 'spm' : 'rpm') : '' }}
{{ $('Get Activity Details').item.json.average_speed && $('Get Activity Details').item.json.type === 'Run' ? 'Pace: ' + Math.floor(1000 / $('Get Activity Details').item.json.average_speed / 60) + ':' + String(Math.round((1000 / $('Get Activity Details').item.json.average_speed) % 60)).padStart(2, '0') + '/km' : '' }}
TSS: {{ $('Get Activity Details').item.json.icu_training_load ? Math.round($('Get Activity Details').item.json.icu_training_load) : 'N/A' }}
IF: {{ $('Get Activity Details').item.json.intensity ? $('Get Activity Details').item.json.intensity.toFixed(2) : 'N/A' }}

=== PLAN MATCHING (tracking only — does NOT affect grade or wording) ===
1. If today's activity clearly corresponds to one of the unmatched sessions of the same sport in the pool, set plan_session_id to that id.
2. If today is a session's pinned_day and the sport matches, prefer that session.
3. Otherwise set plan_session_id to null. This is fine — it just means today wasn't in the suggestion pool.
4. Never re-use a plan_session_id already in ALREADY MATCHED.
5. Whether plan_session_id is null or not has ZERO bearing on grade or message tone.

=== GRADE RUBRIC (session quality only, vs fitness profile) ===
A — Clean execution. Zones held, pacing controlled, cadence in target, no major flags.
B — Solid with one notable flag (mild cardiac drift, minor zone leak, slightly off cadence).
C — Significant execution issues (poor pacing, big zone leaks, mechanical inefficiency, decoupling).
F — Broken session (abandoned, injury risk, severe overreach, data corruption).

A long unplanned Z2 ride that holds zones cleanly is an A. A planned Z2 ride that bleeds 30% into Z3 is a C. The plan is irrelevant; the session is what's graded.

=== ANALYSIS FORMAT ===
[sport-emoji] [Sport] · [duration]min · [distance]km · [avg HR]bpm · TSS [tss]
Grade: [A/B/C/F] — [one reason about session quality, ≤8 words]

• [insight 1 with a specific number]
• [insight 2 with a specific number]
• Limiter: [the one thing holding back progress]

Tomorrow: [session prescription ≤12 words]
Watch: [one metric to track next time ≤8 words]

EMOJI MAP: 🏃 Run · 🏊 Swim · 🚴 Ride/VirtualRide · 💪 Workout · ⛷️ NordicSki · 🚶 Walk · 🥾 Hike

RULES (enforce strictly):
- NEVER prefix the message with "⚠️ Off-plan" or any plan-adherence warning. Header is just session info.
- NEVER use "off-plan", "deviated from plan", "no planned X today", or similar phrasing.
- Do NOT scold or moralize about the athlete deviating from the plan.
- Mention the plan only if it's genuinely useful context (e.g. "swapped today's swim for a ride — fine"). Default to silence about the plan.
- Grade reasoning must reference session quality (zones, pacing, cadence, drift, decoupling), never plan adherence.
- ZERO markdown — no **, no *, no __. Plain text only.
- Bullets are the literal • character.
- Max 8 lines total.
- Use only metrics provided above. Never invent numbers.
- Tone: rigorous, direct, descriptive. Describe; do not judge adherence.
- No preamble, no signoff.

=== OUTPUT (JSON ONLY) ===
{"plan_session_id":"<id from pool, or null>","grade":"A|B|C|F","message":"<full Telegram text with \\n for newlines>"}

Rules:
- grade matches the Grade: line in the message.
- message must NOT start with "⚠️ Off-plan" — ever. Just the session header line.
- Do NOT wrap in code blocks.`;

function sanitize(wf) {
  return {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
    staticData: wf.staticData || null,
  };
}

async function updatePrompt(workflowId, label) {
  console.log(`\n[${label}] fetching ${workflowId}...`);
  const { data: wf } = await client.get(`/workflows/${workflowId}`);
  const llmNode = wf.nodes.find(n => n.name === 'Hardcore Analysis');
  if (!llmNode) throw new Error(`No Hardcore Analysis node in ${workflowId}`);

  const oldLen = llmNode.parameters.text.length;
  llmNode.parameters.text = NEW_PROMPT;
  console.log(`[${label}] prompt: ${oldLen} → ${NEW_PROMPT.length} chars`);

  const { data: result } = await client.put(`/workflows/${workflowId}`, sanitize(wf));
  console.log(`[${label}] PUT ok. versionId: ${result.versionId || '(no versionId returned)'}`);
  console.log(`[${label}] active=${wf.active} — draft updated, activate manually in UI.`);
  console.log(`[${label}] URL: https://apfz.app.n8n.cloud/workflow/${workflowId}`);
}

async function main() {
  try {
    await updatePrompt('hrSGUqoAwkWQ4gKl', 'Daily Checkin');
    await updatePrompt('rHIyZMIJNAOqZvM2', 'Backfill /refresh');
    console.log('\nDone. Open both workflows in n8n UI and click Save to publish drafts as active.');
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
}

main();
