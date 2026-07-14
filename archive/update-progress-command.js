// One-off: add /progress command branch to Feedback Handler (gAnJ0r3x0sFxqWxY)
// Chain: Is /training? false → Is /progress? → Get Progress Sessions → Format Progress → Progress Verdict (Sonnet) → Send Progress
require('dotenv').config();
const BASE = 'https://apfz.app.n8n.cloud/api/v1';
const KEY = process.env.N8N_API_KEY;
const WF_ID = 'gAnJ0r3x0sFxqWxY';

const FORMAT_PROGRESS_CODE = `// /progress scoreboard — last 28d vs prior 28d, duration-weighted, per discipline
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
const pick = (list, c, minDur) => list.filter(s => cat(s) === c && (s.duration_min || 0) >= (minDur || 0));

// duration-weighted average of fn over sessions with valid values
const wAvg = (list, fn) => {
  const items = list.map(s => ({ v: fn(s), w: s.duration_min || 0 }))
    .filter(x => x.v != null && isFinite(x.v) && x.v > 0 && x.w > 0);
  const W = items.reduce((t, x) => t + x.w, 0);
  return W ? { v: items.reduce((t, x) => t + x.v * x.w, 0) / W, n: items.length } : null;
};

const rideEF = s => s.efficiency_factor || (s.avg_power && s.avg_hr ? s.avg_power / s.avg_hr : null);
const runPace = s => s.avg_speed_ms ? 1000 / s.avg_speed_ms / 60 : null;            // min/km
const runSpdHR = s => (s.avg_speed_ms && s.avg_hr) ? (s.avg_speed_ms * 60) / s.avg_hr : null; // m/min per bpm
const runCad = s => s.avg_cadence ? s.avg_cadence * 2 : null;                        // stored half-spm for runs
const swimPace = s => (s.distance_m > 0 && s.moving_sec > 0) ? s.moving_sec / (s.distance_m / 100) : null; // sec/100m

const fmtPace = v => Math.floor(v) + ':' + String(Math.round((v - Math.floor(v)) * 60)).padStart(2, '0');
const fmtSwim = v => Math.floor(v / 60) + ':' + String(Math.round(v % 60)).padStart(2, '0');

// metric line: "• <label> <now> · was <prior> (<±pct>) <arrow>"
const line = (label, rec, pri, fmt, betterUp, suffix) => {
  if (!rec) return null;
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
  const lines = metrics.map(m => line(m.label, wAvg(r, m.fn), wAvg(p, m.fn), m.fmt, m.betterUp, m.suffix)).filter(Boolean);
  if (!lines.length) return;
  sections.push([header + ' (' + r.length + ' vs ' + p.length + ')', ...lines].join('\\n'));
};

addSection('🚴 Ride', 'Ride', 10, [
  { label: 'EF', fn: rideEF, fmt: v => v.toFixed(2) + ' W/bpm', betterUp: true },
  { label: 'Decoupling', fn: s => s.decoupling, fmt: v => v.toFixed(1) + '%', betterUp: false },
]);
addSection('🏃 Run', 'Run', 10, [
  { label: 'Pace', fn: runPace, fmt: v => fmtPace(v) + '/km', betterUp: false },
  { label: 'Speed@HR', fn: runSpdHR, fmt: v => v.toFixed(2), betterUp: true },
  { label: 'Cadence', fn: runCad, fmt: v => Math.round(v) + ' spm', betterUp: true, suffix: 'target 175-180' },
]);
addSection('🏊 Pool', 'Pool', 0, [
  { label: 'Pace', fn: swimPace, fmt: v => fmtSwim(v) + '/100m', betterUp: false },
]);
addSection('🌊 Open water', 'OW', 0, [
  { label: 'Pace', fn: swimPace, fmt: v => fmtSwim(v) + '/100m', betterUp: false },
]);

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

const VERDICT_PROMPT = `=You are a triathlon coach. Below is your athlete's progress scoreboard: last 4 weeks vs the prior 4 weeks (duration-weighted averages, session counts in parentheses). Race: Erkner 70.3 on 2026-09-13.

Write EXACTLY ONE plain-text sentence (max 25 words): an honest verdict — what improved, what didn't, and the single focus for the next block. No emoji, no markdown, no preamble, no quotes.

Honesty caveats: small session counts are noisy; open-water and pool paces are not comparable to each other; ride decoupling is distorted by group-ride sprints; ▲ means improving, ▼ declining.

SCOREBOARD:
{{ $json.scoreboard }}`;

const newNodes = [
  {
    id: 'is-progress', name: 'Is /progress?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1040, 260],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'progress-check', leftValue: '={{ ($json.message.text || "").trim() }}', rightValue: '/progress', operator: { type: 'string', operation: 'startsWith' } }],
        combinator: 'and',
      },
      options: {},
    },
  },
  {
    id: 'get-progress-sessions', name: 'Get Progress Sessions', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1260, 260],
    alwaysOutputData: true,
    parameters: {
      method: 'GET', url: 'https://coach-db.arthurpfz.com/sessions',
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      sendQuery: true,
      queryParameters: { parameters: [
        { name: 'athlete_id', value: '1' },
        { name: 'date_from', value: "={{ $today.minus({ days: 56 }).toFormat('yyyy-MM-dd') }}" },
        { name: 'limit', value: '300' },
      ] },
      options: {},
    },
    credentials: { httpHeaderAuth: { id: '6GNzKYNE1JAz77RL', name: 'Tricoach DB' } },
  },
  {
    id: 'format-progress', name: 'Format Progress', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1480, 260],
    parameters: { mode: 'runOnceForAllItems', jsCode: FORMAT_PROGRESS_CODE },
  },
  {
    id: 'progress-verdict', name: 'Progress Verdict', type: '@n8n/n8n-nodes-langchain.chainLlm', typeVersion: 1.8, position: [1700, 260],
    parameters: { promptType: 'define', text: VERDICT_PROMPT, batching: {} },
  },
  {
    id: 'progress-verdict-model', name: 'Progress Verdict Model', type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter', typeVersion: 1, position: [1700, 440],
    parameters: { model: 'anthropic/claude-sonnet-4.6', options: {} },
    credentials: { openRouterApi: { id: 'nhbNqmgyP4cAeQ6B', name: 'OpenRouter account' } },
  },
  {
    id: 'send-progress', name: 'Send Progress', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [1920, 260],
    parameters: {
      chatId: "={{ $('Telegram Trigger').item.json.message.chat.id.toString() }}",
      text: "={{ $('Format Progress').first().json.scoreboard + '\\n\\n🧠 ' + ($json.text || '').trim() }}",
      additionalFields: { appendAttribution: false },
    },
    credentials: { telegramApi: { id: '9IpAp35yJmIQJpeA', name: 'Telegram account' } },
  },
];

(async () => {
  const get = await fetch(`${BASE}/workflows/${WF_ID}`, { headers: { 'X-N8N-API-KEY': KEY } });
  if (!get.ok) throw new Error(`GET ${get.status}`);
  const wf = await get.json();

  if (wf.nodes.some(n => n.name === 'Is /progress?')) throw new Error('Is /progress? already exists — aborting');

  wf.nodes.push(...newNodes);

  // Rewire: Is /training? false → Is /progress?; Is /progress? false → Is Feedback?
  wf.connections['Is /training?'].main[1] = [{ node: 'Is /progress?', type: 'main', index: 0 }];
  wf.connections['Is /progress?'] = { main: [
    [{ node: 'Get Progress Sessions', type: 'main', index: 0 }],
    [{ node: 'Is Feedback?', type: 'main', index: 0 }],
  ] };
  wf.connections['Get Progress Sessions'] = { main: [[{ node: 'Format Progress', type: 'main', index: 0 }]] };
  wf.connections['Format Progress'] = { main: [[{ node: 'Progress Verdict', type: 'main', index: 0 }]] };
  wf.connections['Progress Verdict'] = { main: [[{ node: 'Send Progress', type: 'main', index: 0 }]] };
  wf.connections['Progress Verdict Model'] = { ai_languageModel: [[{ node: 'Progress Verdict', type: 'ai_languageModel', index: 0 }]] };

  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings });
  const put = await fetch(`${BASE}/workflows/${WF_ID}`, {
    method: 'PUT', headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' }, body,
  });
  console.log('PUT status:', put.status);
  if (!put.ok) { console.log(await put.text()); process.exit(1); }
  const updated = await put.json();
  console.log('nodes:', updated.nodes.length, '| active:', updated.active);
  console.log('Is /training? false →', JSON.stringify(updated.connections['Is /training?'].main[1]));
  console.log('Is /progress? →', JSON.stringify(updated.connections['Is /progress?']));
})();
