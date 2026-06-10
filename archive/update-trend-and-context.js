/**
 * update-trend-and-context.js
 *
 * Adds 30-day trend context and weather/elevation awareness to the Daily
 * Checkin and Backfill workflows. Also adds defensive `distance > 0` to the
 * Filter Activities node.
 *
 * Inserts two new nodes:
 *   Get Trend Sessions  HTTP GET /sessions?athlete_id=&date_from=today-30d&...
 *   Build Trend Stats   Code node — filters by sport, computes 30d aggregates
 *
 * Rewires:
 *   Get Matched Sessions -> Get Trend Sessions -> Build Trend Stats -> Hardcore Analysis
 *
 * Updates Hardcore Analysis prompt with:
 *   - Weather/elevation expressions in the metrics block
 *   - New TREND CONTEXT section
 *   - Rules about environmental context and trend usage
 */
require('dotenv').config({ path: '/Users/arthurpfalzgraf/Desktop/Projects/TRI COACH/.env' });
const axios = require('axios');

const n8n = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
});

const NEW_PROMPT = `=You are an elite endurance coach analyzing a single training session.

GRADE REFLECTS SESSION QUALITY ONLY — how cleanly this session of its kind was executed against the athlete's fitness profile (HR zones, FTP, CSS, cadence targets) AND the day's conditions (terrain, weather). It is NOT a plan-adherence score. An unplanned long ride executed cleanly is an A. A sloppy planned interval set is a C.

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

=== 30-DAY TREND (same sport) ===
{{ $json.trendSummary }}

=== TODAY'S ACTIVITY ===
Activity: {{ $('Get Activity Details').item.json.type }} - {{ $('Get Activity Details').item.json.name }}
Source: {{ $('Get Activity Details').item.json.source }}
Duration: {{ Math.round($('Get Activity Details').item.json.moving_time / 60) }}min
Distance: {{ $('Get Activity Details').item.json.distance ? ($('Get Activity Details').item.json.distance / 1000).toFixed(2) + 'km' : 'N/A' }}

{{ $('Get Activity Details').item.json.total_elevation_gain ? 'Elevation gain: ' + Math.round($('Get Activity Details').item.json.total_elevation_gain) + 'm' : '' }}
{{ $('Get Activity Details').item.json.average_temp ? 'Avg temp: ' + Math.round($('Get Activity Details').item.json.average_temp) + '°C' : '' }}
{{ $('Get Activity Details').item.json.average_wind_speed ? 'Wind: ' + ($('Get Activity Details').item.json.average_wind_speed * 3.6).toFixed(1) + 'km/h' + ($('Get Activity Details').item.json.headwind_percent ? ' (' + Math.round($('Get Activity Details').item.json.headwind_percent) + '% headwind)' : '') : '' }}

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

=== GRADE RUBRIC (session quality only, vs fitness profile + conditions) ===
A — Clean execution. Zones held, pacing controlled, cadence in target, no major flags.
B — Solid with one notable flag (mild cardiac drift, minor zone leak, slightly off cadence).
C — Significant execution issues (poor pacing, big zone leaks, mechanical inefficiency, decoupling).
F — Broken session (abandoned, injury risk, severe overreach, data corruption).

A long unplanned Z2 ride that holds zones cleanly is an A. A planned Z2 ride that bleeds 30% into Z3 is a C. The plan is irrelevant; the session is what's graded.

=== CONDITIONS-AWARE FLAGGING (read carefully) ===
Many "issues" have benign environmental causes. Before flagging cadence, HR, or pacing problems, check the environmental data above:
- Cadence drops on Ride: if elevation_gain > 500m, low cadence is expected on climbs — do NOT flag as inefficiency.
- HR runs hot: if avg_temp > 28°C, expect cardiac drift — do NOT call it overreach.
- Power vs HR mismatch: if headwind_percent > 40%, power required to maintain HR drops — adjust expectations.
- Rough wind: if average_wind_speed > 5 m/s, pacing variability is environmental, not athletic.
Be specific in your reasoning when conditions matter: "68rpm with 1100m of climbing — expected" rather than blanket "low cadence".

=== TREND USAGE ===
Use the 30-day trend section for color when relevant:
- "+8W vs your 30d Ride avg" or "longest swim in 6 weeks" or "decoupling 1.03 vs 1.07 mean — efficiency improving"
- Don't force trend mentions. Only include when a delta is meaningful (>5% or >notable threshold).
- Trend deltas do NOT change the grade rubric. Trend is color, not currency.

=== ANALYSIS FORMAT ===
[sport-emoji] [Sport] · [duration]min · [distance]km · [avg HR]bpm · TSS [tss]
Grade: [A/B/C/F] — [one reason about session quality, ≤8 words]

• [insight 1 with a specific number, ideally trend or condition-aware]
• [insight 2 with a specific number]
• Limiter: [the one thing holding back progress]

Tomorrow: [session prescription ≤12 words]
Watch: [one metric to track next time ≤8 words]

EMOJI MAP: 🏃 Run · 🏊 Swim · 🚴 Ride/VirtualRide · 💪 Workout · ⛷️ NordicSki · 🚶 Walk · 🥾 Hike

RULES (enforce strictly):
- NEVER prefix the message with "⚠️ Off-plan" or any plan-adherence warning. Header is just session info.
- NEVER use "off-plan", "deviated from plan", "no planned X today", or similar phrasing.
- Do NOT scold or moralize about the athlete deviating from the plan.
- Mention the plan only if it's genuinely useful context. Default to silence about the plan.
- Grade reasoning must reference session quality (zones, pacing, cadence, drift, decoupling), never plan adherence.
- When flagging mechanical/physiological issues, account for terrain (elevation_gain) and conditions (temp, wind).
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

const TREND_CODE = `// Build Trend Stats — filters last 30d sessions by current activity sport,
// computes aggregates, returns trendSummary string for the prompt.
const wrapped = $json; // Get Trend Sessions output: {sessions: [...], count: N}
const all = Array.isArray(wrapped.sessions) ? wrapped.sessions : [];
const sport = $('Get Activity Details').first().json.type;
const sessions = all.filter(s => s.sport === sport);

if (sessions.length === 0) {
  return [{ json: { trendSummary: '(no prior ' + sport + ' sessions in last 30d)' } }];
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
lines.push(sport + ' sessions (last 30d): ' + stats.count);
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

function sanitize(wf) {
  return {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
    staticData: wf.staticData || null,
  };
}

function makeTrendNodes(getMatchedNode, hardcorePos) {
  // Position trend nodes between Get Matched Sessions and Hardcore Analysis
  const baseY = getMatchedNode.position[1];
  const getMatchedX = getMatchedNode.position[0];
  return {
    getTrendSessions: {
      id: 'get-trend-sessions-' + Math.random().toString(36).slice(2, 8),
      name: 'Get Trend Sessions',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.3,
      position: [getMatchedX + 100, baseY + 200],
      parameters: {
        method: 'GET',
        url: 'https://coach-db.arthurpfz.com/sessions',
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: 'athlete_id', value: "={{ $('Loop Over Users').item.json.id }}" },
            { name: 'date_from', value: "={{ $today.minus({ days: 30 }).toFormat('yyyy-MM-dd') }}" },
            { name: 'limit', value: '100' },
            { name: 'wrap', value: '1' },
            { name: 'has_analysis', value: '1' },
          ],
        },
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        options: {},
      },
      credentials: {
        httpHeaderAuth: { id: '6GNzKYNE1JAz77RL', name: 'Tricoach DB' },
      },
    },
    buildTrendStats: {
      id: 'build-trend-stats-' + Math.random().toString(36).slice(2, 8),
      name: 'Build Trend Stats',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [getMatchedX + 200, baseY + 200],
      parameters: { jsCode: TREND_CODE },
    },
  };
}

async function updateWorkflow(workflowId, label) {
  console.log(`\n[${label}] fetching ${workflowId}...`);
  const { data: wf } = await n8n.get(`/workflows/${workflowId}`);

  // 1. Filter Activities — add distance > 0 if not present
  const filter = wf.nodes.find(n => n.name === 'Filter Activities');
  if (filter) {
    const conds = filter.parameters.conditions.conditions;
    if (!conds.find(c => c.id === 'drop-empty')) {
      conds.push({
        id: 'drop-empty',
        leftValue: '={{ $json.distance }}',
        rightValue: 0,
        operator: { type: 'number', operation: 'gt' },
      });
      console.log(`  [${label}] added distance > 0 to Filter Activities`);
    } else {
      console.log(`  [${label}] distance > 0 already present`);
    }
  }

  // 2. Add trend nodes if not present
  const hasTrend = wf.nodes.find(n => n.name === 'Get Trend Sessions');
  const getMatched = wf.nodes.find(n => n.name === 'Get Matched Sessions');
  if (!hasTrend) {
    if (!getMatched) throw new Error('Get Matched Sessions node not found — cannot anchor trend nodes');
    const hardcore = wf.nodes.find(n => n.name === 'Hardcore Analysis');
    const { getTrendSessions, buildTrendStats } = makeTrendNodes(getMatched, hardcore.position);
    wf.nodes.push(getTrendSessions, buildTrendStats);

    // Rewire: Get Matched Sessions -> Get Trend Sessions -> Build Trend Stats -> Hardcore Analysis
    wf.connections['Get Matched Sessions'] = {
      main: [[{ node: 'Get Trend Sessions', type: 'main', index: 0 }]],
    };
    wf.connections['Get Trend Sessions'] = {
      main: [[{ node: 'Build Trend Stats', type: 'main', index: 0 }]],
    };
    wf.connections['Build Trend Stats'] = {
      main: [[{ node: 'Hardcore Analysis', type: 'main', index: 0 }]],
    };
    console.log(`  [${label}] inserted Get Trend Sessions + Build Trend Stats`);
  } else {
    console.log(`  [${label}] trend nodes already present`);
  }

  // 3. Update Hardcore Analysis prompt with new trend section + weather/elevation + rules
  const llm = wf.nodes.find(n => n.name === 'Hardcore Analysis');
  const oldLen = llm.parameters.text.length;
  llm.parameters.text = NEW_PROMPT;
  console.log(`  [${label}] prompt updated: ${oldLen} → ${NEW_PROMPT.length} chars`);

  const { data: result } = await n8n.put(`/workflows/${workflowId}`, sanitize(wf));
  console.log(`  [${label}] PUT ok. versionId: ${result.versionId || '(none)'}`);
  console.log(`  [${label}] URL: https://apfz.app.n8n.cloud/workflow/${workflowId}`);
}

(async () => {
  try {
    await updateWorkflow('hrSGUqoAwkWQ4gKl', 'Daily Checkin');
    await updateWorkflow('rHIyZMIJNAOqZvM2', 'Backfill /refresh');
    console.log('\nDone. Both workflows updated and active. Verify with /refresh.');
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
})();
