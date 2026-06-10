/**
 * Fix Build Sport Metrics to handle ICU streams response correctly.
 * ICU returns a single object {type, data: [...]} when one type is requested,
 * not an array of streams. Code node was expecting an array.
 */
require('dotenv').config({ path: '/Users/arthurpfalzgraf/Desktop/Projects/TRI COACH/.env' });
const axios = require('axios');
const n8n = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
});

const FIXED_CODE = `// Build Sport Metrics v2 — handles ICU streams single-object response.
const sport = $('Get Activity Details').first().json.type;
const a = $('Get Activity Details').first().json;
const trendSummary = $('Build Trend Stats').first().json.trendSummary || '';

// Streams: ICU returns either an array of {type, data} OR a single
// {type, data, allNull, ...} when one type was requested. Normalize.
let torqueData = null;
try {
  const sin = $input.all();
  if (sin.length) {
    const first = sin[0].json;
    let candidates = [];
    if (Array.isArray(first)) candidates = first;
    else if (first && typeof first === 'object' && first.type) candidates = [first];
    else if (Array.isArray(first?.data) && first.data[0]?.type) candidates = first.data;
    const torque = candidates.find(s => s && s.type === 'torque');
    if (torque && Array.isArray(torque.data) && !torque.allNull) {
      torqueData = torque.data.filter(v => typeof v === 'number' && v > 0);
    }
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
  const sr = a.average_cadence;
  const dps = a.average_stride;
  const poolLen = a.pool_length;
  const lengths = a.lengths;
  const movingSec = a.moving_time;
  if (sr) lines.push('Stroke rate (SR): ' + sr.toFixed(1) + ' spm');
  if (dps) lines.push('Distance per stroke (DPS): ' + dps.toFixed(2) + ' m');
  if (poolLen && lengths) lines.push('Pool: ' + poolLen + 'm × ' + lengths + ' lengths');
  if (movingSec && lengths && sr) {
    const secsPerLength = movingSec / lengths;
    const strokesPerLength = sr * secsPerLength / 60;
    const swolf = Math.round(secsPerLength + strokesPerLength);
    lines.push('SWOLF: ~' + swolf + ' (' + Math.round(secsPerLength) + 's + ' + Math.round(strokesPerLength) + ' strokes per length)');
  }
  lines.push('Targets: SWOLF <38 strong, 38-45 moderate, >45 work needed. DPS 1.4-1.8m freestyle. Lower SR with high DPS = efficient.');
} else if (sport === 'Ride' || sport === 'VirtualRide') {
  if (typeof a.icu_cadence_z2 === 'number') lines.push('Cadence Z2 time: ' + a.icu_cadence_z2 + 'min in efficient cadence band (out of ' + Math.round(a.moving_time/60) + 'min total)');
  if (typeof a.polarization_index === 'number') lines.push('Polarization index: ' + a.polarization_index.toFixed(2) + ' (lower = more monotone effort, higher = polarized Z1+Z4)');
  if (typeof a.icu_joules_above_ftp === 'number' && a.icu_joules_above_ftp > 0) {
    lines.push('Anaerobic work: ' + Math.round(a.icu_joules_above_ftp / 1000) + ' kJ above FTP');
  }
  if (torqueData && torqueData.length > 100) {
    const mean = torqueData.reduce((s, v) => s + v, 0) / torqueData.length;
    const variance = torqueData.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / torqueData.length;
    const std = Math.sqrt(variance);
    const cv = mean > 0 ? std / mean : 0;
    lines.push('Torque variability (CV): ' + cv.toFixed(2) + ' across ' + torqueData.length + ' pedaling samples (avg torque ' + Math.round(mean) + 'Nm; <0.30 smooth, 0.30-0.50 moderate, >0.50 choppy)');
  }
  lines.push('Note: L/R balance and pedaling smoothness % NOT available — SRAM Apex AXS is a single-sided crank-arm meter (only measures non-drive side).');
}

if (lines.length === 0) lines.push('(no sport-specific form metrics for ' + sport + ')');

return [{ json: { trendSummary, sportMetrics: lines.join('\\n') } }];`;

function sanitize(wf) {
  return { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || {}, staticData: wf.staticData || null };
}

(async () => {
  for (const [id, label] of [['hrSGUqoAwkWQ4gKl', 'Daily Checkin'], ['rHIyZMIJNAOqZvM2', 'Backfill']]) {
    const { data: wf } = await n8n.get(`/workflows/${id}`);
    const node = wf.nodes.find(n => n.name === 'Build Sport Metrics');
    if (!node) throw new Error(`Build Sport Metrics not found in ${id}`);
    node.parameters.jsCode = FIXED_CODE;
    const { data: r } = await n8n.put(`/workflows/${id}`, sanitize(wf));
    console.log(`[${label}] PUT ok. versionId: ${r.versionId}`);
  }
})().catch(e => { console.error(e.response?.data || e.message); process.exit(1); });
