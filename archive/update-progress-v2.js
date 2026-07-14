// One-off: /progress v2 — Z2-only EF/Speed@HR, durability section, swim DPS/SWOLF, HRV/sleep recovery block
// Adds Get Progress Wellness (ICU) node; rewires Is /progress? → wellness → sessions; rewrites Format Progress + verdict prompt.
require('dotenv').config();
const BASE = 'https://apfz.app.n8n.cloud/api/v1';
const KEY = process.env.N8N_API_KEY;
const WF_ID = 'gAnJ0r3x0sFxqWxY';

const FORMAT_PROGRESS_CODE = `// /progress scoreboard v2 — last 28d vs prior 28d, duration-weighted, intensity-filtered
const all = $input.all().map(i => i.json).filter(s => s && s.date);
const cut28 = DateTime.now().minus({ days: 28 }).toFormat('yyyy-MM-dd');
const recent = all.filter(s => s.date >= cut28);
const prior = all.filter(s => s.date < cut28);

const cat = (s) => {
  const sp = (s.sport || '').toLowerCase();
  if (sp.includes('swim')) return sp.includes('open') ? 'OW' : 'Pool';
  if (sp.includes('run')) return 'Run';
  if (sp.includes('ride') || sp.includes('bike') || sp.includes('cycl') || sp.includes('virtual')) return 'Ride';
  return 'Other';
};
const isWed = s => DateTime.fromISO(s.date).weekday === 3; // Rapha day — sprints distort EF/decoupling
const easyRun = s => s.avg_hr > 0 && s.avg_hr <= 150;      // Z2 ceiling ~149bpm
const easyRide = s => !isWed(s) && ((s.intensity_factor > 0 && s.intensity_factor <= 70) || (!s.intensity_factor && s.avg_hr > 0 && s.avg_hr <= 145));
const longSteadyRide = s => !isWed(s) && (s.duration_min || 0) >= 90;

const pick = (list, c, minDur, extra) => list.filter(s => cat(s) === c && (s.duration_min || 0) >= (minDur || 0) && (!extra || extra(s)));

const wAvg = (list, fn) => {
  const items = list.map(s => ({ v: fn(s), w: s.duration_min || 0 }))
    .filter(x => x.v != null && isFinite(x.v) && x.v > 0 && x.w > 0);
  const W = items.reduce((t, x) => t + x.w, 0);
  return W ? { v: items.reduce((t, x) => t + x.v * x.w, 0) / W, n: items.length } : null;
};

const rideEF = s => s.efficiency_factor || (s.avg_power && s.avg_hr ? s.avg_power / s.avg_hr : null);
const runPace = s => s.avg_speed_ms ? 1000 / s.avg_speed_ms / 60 : null;
const runSpdHR = s => (s.avg_speed_ms && s.avg_hr) ? (s.avg_speed_ms * 60) / s.avg_hr : null;
const runCad = s => s.avg_cadence ? s.avg_cadence * 2 : null; // stored half-spm for runs
const swimPace = s => (s.distance_m > 0 && s.moving_sec > 0) ? s.moving_sec / (s.distance_m / 100) : null;
const swimDPS = s => (s.avg_speed_ms > 0 && s.avg_cadence > 0) ? (s.avg_speed_ms * 60) / s.avg_cadence : null; // m per stroke cycle
const poolSwolf = s => { // sec/length + strokes/length, lengths derived from pool_length_m
  if (!(s.pool_length_m > 0 && s.distance_m > 0 && s.moving_sec > 0 && s.avg_cadence > 0)) return null;
  const lengths = s.distance_m / s.pool_length_m;
  return (s.moving_sec / lengths) + ((s.avg_cadence * (s.moving_sec / 60)) / lengths);
};

const fmtPace = v => Math.floor(v) + ':' + String(Math.round((v - Math.floor(v)) * 60)).padStart(2, '0');
const fmtSwim = v => Math.floor(v / 60) + ':' + String(Math.round(v % 60)).padStart(2, '0');

// "• <label> <now> · was <prior> (<±pct>) <arrow>"; if a subset filter yields nothing recent → say so
const line = (label, rec, pri, fmt, betterUp, suffix) => {
  if (!rec && !pri) return null;
  if (!rec) return '• ' + label + ' — none this block (was ' + fmt(pri.v) + ')';
  let out = '• ' + label + ' ' + fmt(rec.v);
  if (pri) {
    const pct = ((rec.v - pri.v) / pri.v) * 100;
    const arrow = Math.abs(pct) < 1 ? '▬' : ((betterUp ? pct > 0 : pct < 0) ? '▲' : '▼');
    out += ' · was ' + fmt(pri.v) + ' (' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%) ' + arrow;
  } else out += ' · no prior data';
  if (suffix) out += ' · ' + suffix;
  return out;
};

const sections = [];
const addSection = (header, c, minDur, metrics) => {
  const r = pick(recent, c, minDur), p = pick(prior, c, minDur);
  if (!r.length && !p.length) return;
  const lines = metrics.map(m => {
    const rr = m.filter ? r.filter(m.filter) : r;
    const pp = m.filter ? p.filter(m.filter) : p;
    const lbl = m.filter ? m.label + ' (' + rr.length + 'v' + pp.length + ')' : m.label;
    return line(lbl, wAvg(rr, m.fn), wAvg(pp, m.fn), m.fmt, m.betterUp, m.suffix);
  }).filter(Boolean);
  if (!lines.length) return;
  sections.push([header + ' (' + r.length + ' vs ' + p.length + ')', ...lines].join('\\n'));
};

addSection('🚴 Ride', 'Ride', 10, [
  { label: 'EF Z2', filter: easyRide, fn: rideEF, fmt: v => v.toFixed(2) + ' W/bpm', betterUp: true },
  { label: 'Decoupling long', filter: longSteadyRide, fn: s => s.decoupling, fmt: v => v.toFixed(1) + '%', betterUp: false },
]);
addSection('🏃 Run', 'Run', 10, [
  { label: 'Pace all', fn: runPace, fmt: v => fmtPace(v) + '/km', betterUp: false },
  { label: 'Speed@HR Z2', filter: easyRun, fn: runSpdHR, fmt: v => v.toFixed(2), betterUp: true },
  { label: 'Cadence', fn: runCad, fmt: v => Math.round(v) + ' spm', betterUp: true, suffix: 'target 175-180' },
]);
addSection('🏊 Pool', 'Pool', 0, [
  { label: 'Pace', fn: swimPace, fmt: v => fmtSwim(v) + '/100m', betterUp: false },
  { label: 'DPS', fn: swimDPS, fmt: v => v.toFixed(2) + ' m/cycle', betterUp: true },
  { label: 'SWOLF', fn: poolSwolf, fmt: v => v.toFixed(1), betterUp: false },
]);
addSection('🌊 Open water', 'OW', 0, [
  { label: 'Pace', fn: swimPace, fmt: v => fmtSwim(v) + '/100m', betterUp: false },
  { label: 'DPS', fn: swimDPS, fmt: v => v.toFixed(2) + ' m/cycle', betterUp: true },
]);

// Durability vs Erkner 70.3 demands (90km bike / 21.1km run)
const maxKm = (list, c) => { const d = pick(list, c, 0).map(s => s.distance_m ? s.distance_m / 1000 : 0); return d.length ? Math.max(...d) : null; };
const dur = [];
const durLine = (label, r, p, race) => {
  if (r == null && p == null) return null;
  let out = '• ' + label + ' ' + (r != null ? r.toFixed(0) + 'km' : 'none');
  if (p != null) out += ' · was ' + p.toFixed(0);
  out += ' · race ' + race;
  return out;
};
const lr = durLine('Long ride', maxKm(recent, 'Ride'), maxKm(prior, 'Ride'), '90km');
const ln = durLine('Long run', maxKm(recent, 'Run'), maxKm(prior, 'Run'), '21km');
if (lr) dur.push(lr);
if (ln) dur.push(ln);
if (dur.length) sections.push(['🏁 Durability', ...dur].join('\\n'));

// Recovery — ICU wellness (Get Progress Wellness, fullResponse: body = array of daily records)
try {
  const wBody = $('Get Progress Wellness').first().json.body;
  const wRecs = Array.isArray(wBody) ? wBody : [];
  const wRecent = wRecs.filter(w => (w.id || '') >= cut28);
  const wPrior = wRecs.filter(w => (w.id || '') < cut28);
  const avg = (list, f) => { const v = list.map(f).filter(x => x != null && isFinite(x) && x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const wLine = (label, r, p, fmt, betterUp) => {
    if (r == null) return null;
    let out = '• ' + label + ' ' + fmt(r);
    if (p != null) {
      const pct = ((r - p) / p) * 100;
      const arrow = Math.abs(pct) < 1 ? '▬' : ((betterUp ? pct > 0 : pct < 0) ? '▲' : '▼');
      out += ' · was ' + fmt(p) + ' ' + arrow;
    }
    return out;
  };
  const fmtSleep = v => Math.floor(v / 3600) + 'h' + String(Math.round((v % 3600) / 60)).padStart(2, '0');
  const rec = [
    wLine('Sleep', avg(wRecent, w => w.sleepSecs), avg(wPrior, w => w.sleepSecs), fmtSleep, true),
    wLine('HRV', avg(wRecent, w => w.hrv), avg(wPrior, w => w.hrv), v => Math.round(v), true),
    wLine('RHR', avg(wRecent, w => w.restingHR), avg(wPrior, w => w.restingHR), v => Math.round(v) + ' bpm', false),
  ].filter(Boolean);
  if (rec.length) sections.push(['💤 Recovery', ...rec].join('\\n'));
} catch (e) { /* wellness unavailable — skip section */ }

// CTL: latest vs last value before the 28d cut
const withCtl = all.filter(s => s.ctl != null).sort((a, b) => a.date < b.date ? -1 : 1);
if (withCtl.length) {
  const nowCtl = withCtl[withCtl.length - 1].ctl;
  const priCtlArr = withCtl.filter(s => s.date < cut28);
  const priCtl = priCtlArr.length ? priCtlArr[priCtlArr.length - 1].ctl : null;
  let l = '• CTL ' + Math.round(nowCtl);
  if (priCtl != null) l += ' · was ' + Math.round(priCtl) + ' ' + (Math.round(nowCtl) > Math.round(priCtl) ? '▲' : Math.round(nowCtl) < Math.round(priCtl) ? '▼' : '▬');
  sections.push('💪 Fitness\\n' + l);
}

const scoreboard = sections.length
  ? '📈 Progress — last 4wk vs prior 4wk\\n\\n' + sections.join('\\n\\n')
  : '📈 Progress — not enough data yet.';
return [{ json: { scoreboard, hasData: sections.length > 0 } }];
`;

const VERDICT_PROMPT = `=You are a triathlon coach. Below is your athlete's progress scoreboard: last 4 weeks vs the prior 4 weeks (duration-weighted; session counts in parentheses; Z2 metrics use easy sessions only). Race: Erkner 70.3 on 2026-09-13 — 1.9km swim, 90km bike, 21.1km run.

Write EXACTLY ONE plain-text sentence (max 30 words): an honest verdict — what improved, what didn't, and the single focus for the next block. No emoji, no markdown, no preamble, no quotes.

Honesty caveats: small counts are noisy; open-water and pool paces are not comparable; "Speed@HR Z2 — none this block" means zero easy runs were logged (a broken 80/20 polarization, worth calling out); Durability shows longest sessions vs race demands.

SCOREBOARD:
{{ $json.scoreboard }}`;

const WELLNESS_NODE = {
  id: 'get-progress-wellness', name: 'Get Progress Wellness', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1150, 400],
  alwaysOutputData: true,
  parameters: {
    method: 'GET',
    url: 'https://intervals.icu/api/v1/athlete/i492254/wellness',
    authentication: 'genericCredentialType', genericAuthType: 'httpBasicAuth',
    sendQuery: true,
    queryParameters: { parameters: [
      { name: 'oldest', value: "={{ $today.minus({ days: 56 }).toFormat('yyyy-MM-dd') }}" },
      { name: 'newest', value: "={{ $today.toFormat('yyyy-MM-dd') }}" },
    ] },
    options: { response: { response: { fullResponse: true, neverError: true } } },
  },
  credentials: { httpBasicAuth: { id: 'ms91wbaCvecB3tqQ', name: 'Intervals.icu API' } },
};

(async () => {
  const get = await fetch(`${BASE}/workflows/${WF_ID}`, { headers: { 'X-N8N-API-KEY': KEY } });
  if (!get.ok) throw new Error(`GET ${get.status}`);
  const wf = await get.json();

  if (wf.nodes.some(n => n.name === 'Get Progress Wellness')) throw new Error('v2 already applied — aborting');

  wf.nodes.find(n => n.name === 'Format Progress').parameters.jsCode = FORMAT_PROGRESS_CODE;
  wf.nodes.find(n => n.name === 'Progress Verdict').parameters.text = VERDICT_PROMPT;
  wf.nodes.push(WELLNESS_NODE);

  // Is /progress? true → Get Progress Wellness (1 item) → Get Progress Sessions (runs once) → Format Progress
  wf.connections['Is /progress?'].main[0] = [{ node: 'Get Progress Wellness', type: 'main', index: 0 }];
  wf.connections['Get Progress Wellness'] = { main: [[{ node: 'Get Progress Sessions', type: 'main', index: 0 }]] };

  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });
  const put = await fetch(`${BASE}/workflows/${WF_ID}`, {
    method: 'PUT', headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' }, body,
  });
  console.log('PUT status:', put.status);
  if (!put.ok) { console.log(await put.text()); process.exit(1); }
  const updated = await put.json();
  console.log('nodes:', updated.nodes.length, '| active:', updated.active);
  console.log('Is /progress? true →', JSON.stringify(updated.connections['Is /progress?'].main[0]));
  console.log('Get Progress Wellness →', JSON.stringify(updated.connections['Get Progress Wellness']));
})();
