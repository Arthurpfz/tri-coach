// One-off: add plan-adherence + CTL trend to Sunday Planner (lUcAtn2oxCPkNkJ1)
require('dotenv').config();
const axios = require('axios');

const BASE = process.env.N8N_API_URL || 'https://apfz.app.n8n.cloud/api/v1';
const KEY = process.env.N8N_API_KEY;
const ID = 'lUcAtn2oxCPkNkJ1';

const CONTEXT_CODE = `const athlete = $('Search records').first().json;
const wrapped = $('Get Last Week Sessions').first().json;
const all = Array.isArray(wrapped.sessions) ? wrapped.sessions : [];

// Running week = Monday..today (planner runs Sunday evening planning next week)
const thisMon = DateTime.now().startOf('week').toFormat('yyyy-MM-dd');
const lastWeek = all.filter(s => (s.date || '') >= thisMon);

const lines = [];
if (lastWeek.length === 0) {
  lines.push('No sessions logged last week.');
} else {
  const totalMin = lastWeek.reduce((s, x) => s + (x.duration_min || 0), 0);
  const totalTSS = lastWeek.reduce((s, x) => s + (parseFloat(x.tss) || 0), 0);
  const grades = lastWeek.filter(x => x.grade).map(x => x.grade);
  lines.push(lastWeek.length + ' session' + (lastWeek.length > 1 ? 's' : '') +
             ' · ' + (totalMin / 60).toFixed(1) + 'h · TSS ' + Math.round(totalTSS));
  if (grades.length) lines.push('Grades: ' + grades.join(', '));
  lastWeek.slice().reverse().forEach(s => {
    const head = [
      (s.date || '').slice(5),
      s.sport || '?',
      s.duration_min ? s.duration_min + 'min' : null,
      s.tss ? 'TSS ' + Math.round(s.tss) : null,
      s.grade ? 'Grade ' + s.grade : null,
    ].filter(Boolean).join(' · ');
    lines.push('  - ' + head);
    if (s.analysis) {
      const oneLiner = String(s.analysis).split('\\n').find(l => l.trim()) || '';
      if (oneLiner) lines.push('    ' + oneLiner.slice(0, 140));
    }
  });
}

// --- Plan adherence: planned blocks vs what actually got done ---
let planItems = [];
try {
  const p = $('Get Last Week Plan').first().json;
  if (p && Array.isArray(p.sessions)) planItems = p.sessions;
} catch (e) {}

let adherenceSummary = 'No plan found for last week — nothing to compare against.';
if (planItems.length) {
  const used = new Set();
  const rows = planItems.map(p => {
    let m = lastWeek.find(s => !used.has(s.id) && s.plan_session_id === p.id);
    if (!m) m = lastWeek.find(s => !used.has(s.id) && !s.plan_session_id &&
      (s.sport || '').toLowerCase() === (p.sport || '').toLowerCase());
    if (m) {
      used.add(m.id);
      return '  - ' + p.label + ' ' + p.sport + ' ' + p.duration_min + 'min (' + p.id + '): DONE ' +
        (m.date || '').slice(5) + ' ' + (m.duration_min || '?') + 'min' + (m.grade ? ' · Grade ' + m.grade : '');
    }
    return '  - ' + p.label + ' ' + p.sport + ' ' + p.duration_min + 'min (' + p.id + '): SKIPPED';
  });
  const extras = lastWeek.filter(s => !used.has(s.id)).map(s =>
    '  - Unplanned: ' + s.sport + ' ' + (s.duration_min || '?') + 'min ' + (s.date || '').slice(5) +
    (s.grade ? ' · Grade ' + s.grade : ''));
  adherenceSummary = rows.concat(extras).join('\\n');
}

// --- Fitness trend: CTL now vs oldest session in the 4-week window ---
const withCtl = all.filter(s => s.ctl != null && s.duration_min > 0);
let ctlLine = 'No CTL data available.';
if (withCtl.length) {
  const ctlNow = Math.round(withCtl[0].ctl);
  const oldest = withCtl[withCtl.length - 1];
  const spanDays = Math.round(DateTime.fromISO(withCtl[0].date).diff(DateTime.fromISO(oldest.date), 'days').days);
  if (spanDays >= 14) {
    const ctlPast = Math.round(oldest.ctl);
    const delta = ctlNow - ctlPast;
    ctlLine = 'CTL ' + ctlNow + ' (' + (delta >= 0 ? '+' : '') + delta + ' vs ' + Math.round(spanDays / 7) + 'wk ago' +
      (delta < 0 ? ' — fitness declining, consistency is the lever' : delta > 2 ? ' — building well' : ' — holding steady') + ')';
  } else {
    ctlLine = 'CTL ' + ctlNow;
  }
}

// --- Periodization: live weeks-to-race -> phase + weekly volume target ---
const raceDate = DateTime.fromISO(athlete['Race Date']);
const nextMon  = DateTime.now().endOf('week').plus({ days: 1 });
const W = Math.max(0, Math.ceil(raceDate.diff(nextMon, 'weeks').weeks));
let phase;
if (W >= 11) phase = 'Base'; else if (W >= 7) phase = 'Build';
else if (W >= 4) phase = 'Peak'; else if (W >= 2) phase = 'Taper'; else phase = 'Race Week';
let hours;
if (W >= 10)      hours = Math.max(6, Math.min(8, 6 + (14 - W) * 0.5));
else if (W >= 4)  hours = 8;
else if (W === 3) hours = 6.5;
else if (W === 2) hours = 5;
else              hours = 3.5;

return [{ json: { ...athlete, lastWeekSummary: lines.join('\\n'), adherenceSummary, ctlLine, weeks_to_race: W, weekly_hours_target: hours, 'Training Phase': phase } }];`;

async function main() {
  const h = { headers: { 'X-N8N-API-KEY': KEY } };
  const wf = (await axios.get(`${BASE}/workflows/${ID}`, h)).data;

  // 1. New node: Get Last Week Plan (running week's plan, for adherence)
  const gls = wf.nodes.find(n => n.name === 'Get Last Week Sessions');
  wf.nodes.push({
    name: 'Get Last Week Plan',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [gls.position[0] + 200, gls.position[1] + 180],
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: gls.credentials,
    parameters: {
      method: 'GET',
      url: 'https://coach-db.arthurpfz.com/weekly-plans',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendQuery: true,
      queryParameters: { parameters: [
        { name: 'athlete_id', value: "={{ $('Search records').item.json.id }}" },
        { name: 'week_start_date', value: "={{ $today.startOf('week').toFormat('yyyy-MM-dd') }}" },
      ]},
      options: {},
    },
  });

  // 2. Rewire: Sessions -> Plan -> Build Prompt Context
  wf.connections['Get Last Week Sessions'] = { main: [[{ node: 'Get Last Week Plan', type: 'main', index: 0 }]] };
  wf.connections['Get Last Week Plan'] = { main: [[{ node: 'Build Prompt Context', type: 'main', index: 0 }]] };

  // 3. Widen sessions query to 4 weeks (CTL trend window); drop date_to; raise limit
  gls.parameters.queryParameters.parameters = [
    { name: 'athlete_id', value: "={{ $('Search records').item.json.id }}" },
    { name: 'date_from', value: "={{ $today.startOf('week').minus({ weeks: 3 }).toFormat('yyyy-MM-dd') }}" },
    { name: 'limit', value: '60' },
    { name: 'wrap', value: '1' },
    { name: 'has_analysis', value: '1' },
  ];

  // 4. Rewrite Build Prompt Context
  wf.nodes.find(n => n.name === 'Build Prompt Context').parameters.jsCode = CONTEXT_CODE;

  // 5. Prompt: adherence + fitness trend blocks, Rule 7 extension
  const llm = wf.nodes.find(n => n.name === 'Basic LLM Chain');
  let text = llm.parameters.text;
  const execBlock = "=== LAST WEEK'S EXECUTION ===\n{{ $json.lastWeekSummary }}";
  if (!text.includes(execBlock)) throw new Error('exec block anchor not found');
  text = text.replace(execBlock, execBlock +
    "\n\n=== LAST WEEK PLAN ADHERENCE (planned blocks vs done) ===\n{{ $json.adherenceSummary }}" +
    "\n\n=== FITNESS TREND ===\n{{ $json.ctlLine }}");
  const rule7old = `7. Adapt to LAST WEEK'S EXECUTION:
   - C/F grades or low volume → trim load this week.
   - All A/B → stay the course or marginal increase within phase guidelines.
   - No sessions logged → plan conservatively.`;
  if (!text.includes(rule7old)) throw new Error('rule 7 anchor not found');
  text = text.replace(rule7old, `7. Adapt to LAST WEEK'S EXECUTION, PLAN ADHERENCE and FITNESS TREND:
   - C/F grades or low volume → trim load this week.
   - All A/B → stay the course or marginal increase within phase guidelines.
   - No sessions logged → plan conservatively.
   - If a KEY session was SKIPPED — especially Swim, the priority discipline — keep it in this week's plan and name the carry-over in the focus line. Don't silently drop neglected work.
   - If the athlete repeatedly substituted one sport for another (unplanned extras vs skips), rebalance toward the neglected sport rather than scolding.
   - Declining CTL → bias toward consistency and completable sessions over intensity. Rising CTL → current progression is working; hold it.`);
  llm.parameters.text = text;

  // 6. Telegram: append fitness trend line
  const tg = wf.nodes.find(n => n.name === 'Build Plan Telegram');
  tg.parameters.jsCode = tg.parameters.jsCode.replace(
    "out += '\\n\\nGo crush it! 🚀';",
    `const ctlLine = $('Build Prompt Context').first().json.ctlLine;
if (ctlLine && !ctlLine.startsWith('No CTL')) out += '\\n\\n📈 ' + ctlLine;
out += '\\n\\nGo crush it! 🚀';`);
  if (!tg.parameters.jsCode.includes('ctlLine')) throw new Error('telegram anchor not found');

  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings };
  const res = await axios.put(`${BASE}/workflows/${ID}`, body, h);
  console.log('PUT', res.status, '| active:', res.data.active, '| nodes:', res.data.nodes.length);
}

main().catch(e => { console.error(e.response ? JSON.stringify(e.response.data) : e.message); process.exit(1); });
