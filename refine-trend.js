/**
 * refine-trend.js
 *
 * Two refinements after first /refresh feedback:
 *  1. Build Trend Stats now filters garbage sessions (duration_min < 10 OR null
 *     distance_km on cycling) before aggregating. Stops polluting averages.
 *  2. Hardcore Analysis prompt: tighten the trend rule so the LLM uses trend
 *     context when there's a notable delta, instead of treating it as fully
 *     optional.
 */
require('dotenv').config({ path: '/Users/arthurpfalzgraf/Desktop/Projects/TRI COACH/.env' });
const axios = require('axios');

const n8n = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
});

const TREND_CODE_V2 = `// Build Trend Stats v2 — filters garbage sessions before aggregating.
// Garbage = duration_min < 10 OR (sport in cycling/running and distance_km is null/<=0)
const wrapped = $json;
const all = Array.isArray(wrapped.sessions) ? wrapped.sessions : [];
const sport = $('Get Activity Details').first().json.type;
const sessions = all.filter(s => {
  if (s.sport !== sport) return false;
  if (!s.duration_min || s.duration_min < 10) return false;
  // For distance-based sports, drop null/zero distance records (incomplete uploads)
  if (['Ride','VirtualRide','Run','Swim','Walk','Hike'].includes(sport)) {
    if (!s.distance_km || s.distance_km <= 0) return false;
  }
  return true;
});

if (sessions.length === 0) {
  return [{ json: { trendSummary: '(no comparable ' + sport + ' sessions in last 30d)' } }];
}

const numAvg = (arr, k) => {
  const vals = arr.map(s => parseFloat(s[k])).filter(v => !isNaN(v) && v !== 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};
const round1 = n => n == null ? null : Math.round(n * 10) / 10;

const stats = {
  count: sessions.length,
  avg_duration: numAvg(sessions, 'duration_min'),
  avg_distance: numAvg(sessions, 'distance_km'),
  avg_tss: numAvg(sessions, 'tss'),
  avg_hr: numAvg(sessions, 'avg_hr'),
  avg_power: numAvg(sessions, 'avg_power'),
  avg_decoupling: numAvg(sessions, 'decoupling'),
  avg_ef: numAvg(sessions, 'efficiency_factor'),
};
const longest = sessions.reduce((m, s) => (s.duration_min || 0) > (m?.duration_min || 0) ? s : m, null);
const grades = sessions.filter(s => s.grade).map(s => s.grade);
const gradeBreakdown = ['A','B','C','F'].map(g => g + ':' + grades.filter(x => x === g).length).join(' ');

const lines = [];
lines.push(sport + ' sessions (last 30d, valid only): ' + stats.count);
const avgParts = [];
if (stats.avg_duration) avgParts.push(Math.round(stats.avg_duration) + 'min');
if (stats.avg_distance) avgParts.push(round1(stats.avg_distance) + 'km');
if (stats.avg_tss) avgParts.push('TSS ' + Math.round(stats.avg_tss));
if (stats.avg_hr) avgParts.push('HR ' + Math.round(stats.avg_hr) + 'bpm');
if (avgParts.length) lines.push('Avg: ' + avgParts.join(' · '));
if (stats.avg_power) lines.push('Avg power: ' + Math.round(stats.avg_power) + 'W');
if (stats.avg_decoupling) lines.push('Avg decoupling: ' + round1(stats.avg_decoupling));
if (stats.avg_ef) lines.push('Avg efficiency factor: ' + round1(stats.avg_ef));
if (longest && longest.duration_min) lines.push('Longest: ' + longest.duration_min + 'min on ' + longest.date);
if (grades.length) lines.push('Grade distribution (A/B/C/F): ' + gradeBreakdown);

return [{ json: { trendSummary: lines.join('\\n') } }];`;

const TREND_RULE_OLD = `=== TREND USAGE ===
Use the 30-day trend section for color when relevant:
- "+8W vs your 30d Ride avg" or "longest swim in 6 weeks" or "decoupling 1.03 vs 1.07 mean — efficiency improving"
- Don't force trend mentions. Only include when a delta is meaningful (>5% or >notable threshold).
- Trend deltas do NOT change the grade rubric. Trend is color, not currency.`;

const TREND_RULE_NEW = `=== TREND USAGE (REQUIRED when comparable data exists) ===
The 30-day trend section gives you color. When the trend has ≥2 valid sessions, you MUST surface at least one trend-anchored insight in the bullets if any of these are true:
- Today's avg_hr differs from 30d avg HR by >5bpm
- Today's avg_power differs from 30d avg power by >5%
- Today's duration is the longest or shortest of last 30d for this sport
- Today's decoupling/EF is meaningfully different from the 30d mean
- Today's grade extends or breaks a streak (e.g. "first A in 4 rides", "third C in a row")

Phrase as concrete deltas: "HR 149bpm — +22 vs your 30d Ride avg of 127bpm, ran significantly harder" rather than "HR was high".

If the trend section says "(no comparable...)" you have no trend data — skip this rule.

Trend deltas do NOT change the grade rubric. Trend is color, not currency.`;

function sanitize(wf) {
  return {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
    staticData: wf.staticData || null,
  };
}

async function refine(workflowId, label) {
  console.log(`\n[${label}] fetching ${workflowId}...`);
  const { data: wf } = await n8n.get(`/workflows/${workflowId}`);

  const trendNode = wf.nodes.find(n => n.name === 'Build Trend Stats');
  if (!trendNode) throw new Error('Build Trend Stats node not found');
  trendNode.parameters.jsCode = TREND_CODE_V2;
  console.log(`  [${label}] Build Trend Stats jsCode updated`);

  const llm = wf.nodes.find(n => n.name === 'Hardcore Analysis');
  const oldText = llm.parameters.text;
  if (!oldText.includes(TREND_RULE_OLD)) {
    console.warn(`  [${label}] WARN: old TREND USAGE block not found verbatim — prompt may have drifted`);
  }
  const newText = oldText.replace(TREND_RULE_OLD, TREND_RULE_NEW);
  if (newText === oldText) {
    console.warn(`  [${label}] WARN: prompt unchanged after replace — TREND USAGE section not found`);
  } else {
    llm.parameters.text = newText;
    console.log(`  [${label}] Hardcore Analysis prompt: ${oldText.length} → ${newText.length} chars`);
  }

  const { data: result } = await n8n.put(`/workflows/${workflowId}`, sanitize(wf));
  console.log(`  [${label}] PUT ok. versionId: ${result.versionId || '(none)'}`);
}

(async () => {
  try {
    await refine('hrSGUqoAwkWQ4gKl', 'Daily Checkin');
    await refine('rHIyZMIJNAOqZvM2', 'Backfill /refresh');
    console.log('\nDone.');
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
})();
