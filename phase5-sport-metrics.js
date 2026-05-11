/**
 * phase5-sport-metrics.js
 *
 * Adds sport-specific form metrics to Daily Checkin and Backfill workflows:
 *  - Run: cadence (×2 spm), stride length, pace, targets, honest "no Running Dynamics" note
 *  - Swim: computed SWOLF, stroke rate, distance per stroke, pool details, targets
 *  - Ride: cadence Z2 time, polarization index, anaerobic kJ, torque variability (CV)
 *          from per-second torque stream, honest "no L/R balance" note
 *
 * New nodes:
 *   Get Activity Streams  HTTP GET intervals.icu /activity/{id}/streams?types=torque
 *   Build Sport Metrics   Code node — computes sport-specific output for prompt
 *
 * Inserted between Build Trend Stats and Hardcore Analysis.
 * Hardcore Analysis prompt gains a SPORT-SPECIFIC FORM METRICS section and form
 * coaching rules.
 */
require('dotenv').config({ path: '/Users/arthurpfalzgraf/Desktop/Projects/TRI COACH/.env' });
const axios = require('axios');

const n8n = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
});

const ICU_CRED_ID = 'JBZzr0E5U1GSy6OQ';

const SPORT_METRICS_CODE = `// Build Sport Metrics — derives technique-level signals per sport.
const sport = $('Get Activity Details').first().json.type;
const a = $('Get Activity Details').first().json;
const trendSummary = $('Build Trend Stats').first().json.trendSummary || '';

// Streams response: array of {type, data}. May be empty or error on non-cycling.
let streams = [];
try {
  const sin = $input.all();
  if (sin.length) {
    const first = sin[0].json;
    if (Array.isArray(first)) streams = first;
    else if (Array.isArray(first.data)) streams = first.data;
  }
} catch (e) {}

const lines = [];

if (sport === 'Run') {
  const cadenceSpm = a.average_cadence ? Math.round(a.average_cadence * 2) : null;
  const stride = a.average_stride;
  if (cadenceSpm) lines.push('Cadence: ' + cadenceSpm + ' spm (total stride rate)');
  if (stride) lines.push('Stride length: ' + stride.toFixed(2) + ' m');
  if (a.average_speed) {
    const paceSec = 1000 / a.average_speed;
    const min = Math.floor(paceSec / 60);
    const sec = Math.round(paceSec % 60);
    lines.push('Pace: ' + min + ':' + String(sec).padStart(2, '0') + '/km');
  }
  lines.push('Targets: cadence 170-180 spm at endurance pace; stride length 0.85-1.10 m at Z2');
  lines.push('Note: Running Dynamics (GCT, vertical oscillation, vertical ratio) NOT available — COROS PACE 3 wrist-only does not capture these. Stride/cadence-based form coaching only.');
} else if (sport === 'Swim') {
  const sr = a.average_cadence; // strokes per min
  const dps = a.average_stride; // distance per stroke (m)
  const poolLen = a.pool_length;
  const lengths = a.lengths;
  const movingSec = a.moving_time;
  if (sr) lines.push('Stroke rate (SR): ' + sr.toFixed(1) + ' spm');
  if (dps) lines.push('Distance per stroke (DPS): ' + dps.toFixed(2) + ' m');
  if (poolLen && lengths) lines.push('Pool: ' + poolLen + 'm × ' + lengths + ' lengths');
  // SWOLF = seconds per length + strokes per length
  if (movingSec && lengths && sr) {
    const secsPerLength = movingSec / lengths;
    const strokesPerLength = sr * secsPerLength / 60;
    const swolf = Math.round(secsPerLength + strokesPerLength);
    lines.push('SWOLF: ~' + swolf + ' (' + Math.round(secsPerLength) + 's + ' + Math.round(strokesPerLength) + ' strokes per length)');
  }
  lines.push('Targets: SWOLF <38 strong, 38-45 moderate, >45 work needed. DPS 1.4-1.8m freestyle. Lower SR with high DPS = efficient.');
} else if (sport === 'Ride' || sport === 'VirtualRide') {
  if (typeof a.icu_cadence_z2 === 'number') lines.push('Cadence Z2 time: ' + a.icu_cadence_z2 + 'min in efficient cadence band');
  if (typeof a.polarization_index === 'number') lines.push('Polarization index: ' + a.polarization_index.toFixed(2) + ' (1=monotone, 2+=polarized)');
  if (typeof a.icu_joules_above_ftp === 'number' && a.icu_joules_above_ftp > 0) {
    lines.push('Anaerobic work: ' + Math.round(a.icu_joules_above_ftp / 1000) + ' kJ above FTP');
  }
  // Torque variability from streams
  let tStream = null;
  if (Array.isArray(streams)) {
    const found = streams.find(s => s && s.type === 'torque');
    if (found && Array.isArray(found.data)) {
      tStream = found.data.filter(v => typeof v === 'number' && v > 0);
    }
  }
  if (tStream && tStream.length > 100) {
    const mean = tStream.reduce((s, v) => s + v, 0) / tStream.length;
    const variance = tStream.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / tStream.length;
    const std = Math.sqrt(variance);
    const cv = mean > 0 ? std / mean : 0;
    lines.push('Torque variability (CV): ' + cv.toFixed(2) + ' across ' + tStream.length + ' samples (<0.30 smooth, 0.30-0.50 moderate, >0.50 choppy)');
  }
  lines.push('Note: L/R balance and pedaling smoothness % NOT available — SRAM Apex AXS is a single-sided crank-arm meter (only measures non-drive side).');
}

if (lines.length === 0) lines.push('(no sport-specific form metrics for ' + sport + ')');

return [{ json: { trendSummary, sportMetrics: lines.join('\\n') } }];`;

const NEW_FORM_SECTION = `=== SPORT-SPECIFIC FORM METRICS ===
{{ $json.sportMetrics }}

=== FORM COACHING RULES ===
When Sport-Specific Form Metrics are present, give technique-level coaching in addition to zone/pacing analysis:
- Run: if cadence < 165 spm, prescribe cadence increase ("aim 170-175 spm — shortens stride, reduces overstride"). If stride length is short for the pace, may indicate overstride compensating for low cadence. Don't invent GCT/oscillation values — the prompt explicitly notes they're unavailable.
- Swim: if SWOLF > 40, push stroke economy ("longer glide, drop SR by 2"). If DPS < 1.3, target distance per stroke. Suggest breathing pattern adjustments (e.g. breathe every 3 vs every 2) if HR runs high at moderate effort.
- Ride: if torque variability CV > 0.40, comment on pedaling consistency ("torque CV 0.48 — choppy pedaling, work on smooth stroke through the dead spot"). If icu_cadence_z2 < 40% of moving time, note that the avg cadence number hides long stretches at inefficient RPMs. Do NOT mention L/R balance or pedaling smoothness % — single-sided meter, data doesn't exist.

Be honest about missing data. NEVER invent Running Dynamics, L/R balance, or per-leg pedaling metrics. The metrics block tells you what's available.

`;

const ANCHOR_BEFORE_FORM = '=== ANALYSIS FORMAT (EXACTLY 3 BULLETS — no more, no less) ===';

function sanitize(wf) {
  return {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
    staticData: wf.staticData || null,
  };
}

function makeStreamsNode(buildTrendNode) {
  const [x, y] = buildTrendNode.position;
  return {
    id: 'get-activity-streams-' + Math.random().toString(36).slice(2, 8),
    name: 'Get Activity Streams',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [x + 100, y + 200],
    parameters: {
      method: 'GET',
      url: "=https://intervals.icu/api/v1/activity/{{ $('Get Activity Details').item.json.id }}/streams",
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'types', value: 'torque' },
        ],
      },
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBasicAuth',
      options: {},
    },
    credentials: {
      httpBasicAuth: { id: ICU_CRED_ID, name: 'Intervals.icu' },
    },
    onError: 'continueRegularOutput',
  };
}

function makeMetricsNode(streamsNode) {
  const [x, y] = streamsNode.position;
  return {
    id: 'build-sport-metrics-' + Math.random().toString(36).slice(2, 8),
    name: 'Build Sport Metrics',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 100, y],
    parameters: { jsCode: SPORT_METRICS_CODE },
  };
}

async function update(workflowId, label) {
  console.log(`\n[${label}] fetching ${workflowId}...`);
  const { data: wf } = await n8n.get(`/workflows/${workflowId}`);

  const buildTrend = wf.nodes.find(n => n.name === 'Build Trend Stats');
  if (!buildTrend) throw new Error('Build Trend Stats not found');

  // 1. Add Get Activity Streams + Build Sport Metrics if not present
  let streamsNode = wf.nodes.find(n => n.name === 'Get Activity Streams');
  let metricsNode = wf.nodes.find(n => n.name === 'Build Sport Metrics');
  if (!streamsNode) {
    streamsNode = makeStreamsNode(buildTrend);
    wf.nodes.push(streamsNode);
    console.log(`  [${label}] added Get Activity Streams`);
  }
  if (!metricsNode) {
    metricsNode = makeMetricsNode(streamsNode);
    wf.nodes.push(metricsNode);
    console.log(`  [${label}] added Build Sport Metrics`);
  } else {
    // refresh code in case we re-run
    metricsNode.parameters.jsCode = SPORT_METRICS_CODE;
    console.log(`  [${label}] refreshed Build Sport Metrics jsCode`);
  }

  // 2. Rewire: Build Trend Stats -> Get Activity Streams -> Build Sport Metrics -> Hardcore Analysis
  wf.connections['Build Trend Stats'] = {
    main: [[{ node: 'Get Activity Streams', type: 'main', index: 0 }]],
  };
  wf.connections['Get Activity Streams'] = {
    main: [[{ node: 'Build Sport Metrics', type: 'main', index: 0 }]],
  };
  wf.connections['Build Sport Metrics'] = {
    main: [[{ node: 'Hardcore Analysis', type: 'main', index: 0 }]],
  };

  // 3. Prompt: inject SPORT-SPECIFIC FORM METRICS section if not present
  const llm = wf.nodes.find(n => n.name === 'Hardcore Analysis');
  const oldText = llm.parameters.text;
  if (oldText.includes('=== SPORT-SPECIFIC FORM METRICS ===')) {
    console.log(`  [${label}] form section already present — refreshing instead of inserting`);
    // Replace from existing marker through end of form rules block
    const start = oldText.indexOf('=== SPORT-SPECIFIC FORM METRICS ===');
    const end = oldText.indexOf(ANCHOR_BEFORE_FORM);
    if (start >= 0 && end > start) {
      const newText = oldText.slice(0, start) + NEW_FORM_SECTION + oldText.slice(end);
      llm.parameters.text = newText;
      console.log(`  [${label}] form section refreshed: ${oldText.length} → ${newText.length} chars`);
    }
  } else {
    if (!oldText.includes(ANCHOR_BEFORE_FORM)) throw new Error('ANCHOR_BEFORE_FORM not found in prompt');
    const newText = oldText.replace(ANCHOR_BEFORE_FORM, NEW_FORM_SECTION + ANCHOR_BEFORE_FORM);
    llm.parameters.text = newText;
    console.log(`  [${label}] form section inserted: ${oldText.length} → ${newText.length} chars`);
  }

  const { data: result } = await n8n.put(`/workflows/${workflowId}`, sanitize(wf));
  console.log(`  [${label}] PUT ok. versionId: ${result.versionId}`);
}

(async () => {
  try {
    await update('hrSGUqoAwkWQ4gKl', 'Daily Checkin');
    await update('rHIyZMIJNAOqZvM2', 'Backfill /refresh');
    console.log('\nDone.');
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
})();
