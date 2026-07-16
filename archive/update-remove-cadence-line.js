// Remove the 🦵 run cadence trend line from Weekly Stats + /strikes.
// Redundant since /progress (2026-07-14) reports cadence with proper 28d-vs-28d context;
// per-run cadence coaching already happens in the daily analysis. Also reverts the
// 56d session fetch (added only for this trend) back to the running week.
require('dotenv').config();
const BASE = process.env.N8N_API_URL;
const KEY = process.env.N8N_API_KEY;

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

function stripCadence(code) {
  const before = code;
  code = code.replace(/\n\/\/ Run cadence trend:[\s\S]*?\n}\n/, '\n');
  code = code.replace(/\nif \(cadenceLine\) lines\.push\('', cadenceLine\);/, '');
  code = code.replace(/; fetch window is 56d for the cadence trend\./, '.');
  code = code.replace(/ — same logic as Weekly Stats workflow; 56d fetch for cadence trend\./, ' — same logic as Weekly Stats workflow.');
  if (code === before) throw new Error('no changes applied — code layout unexpected');
  if (code.includes('🦵') || code.includes('cadenceLine')) throw new Error('cadence remnants left behind');
  new Function(code.replace(/\$input/g, 'x').replace(/DateTime/g, 'Date')); // syntax check only
  return code;
}

const WEEK_FROM = "={{ $today.startOf('week').toFormat('yyyy-MM-dd') }}";

async function update(workflowId, codeNodeName, fetchNodeName, label) {
  const wf = await api('GET', `/workflows/${workflowId}`);
  const codeNode = wf.nodes.find(n => n.name === codeNodeName);
  codeNode.parameters.jsCode = stripCadence(codeNode.parameters.jsCode);
  const fetchNode = wf.nodes.find(n => n.name === fetchNodeName);
  const dateFrom = fetchNode.parameters.queryParameters.parameters.find(p => p.name === 'date_from');
  dateFrom.value = WEEK_FROM;
  const res = await api('PUT', `/workflows/${workflowId}`, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings,
  });
  console.log(`${label} updated — active=${res.active}`);
}

(async () => {
  await update('2W0SIHwzyAWJW62Q', 'Format Stats', 'Get Sessions', 'Weekly Stats');
  await update('gAnJ0r3x0sFxqWxY', 'Format Strikes', 'Get Strikes Sessions', 'Feedback Handler (/strikes)');
})().catch(e => { console.error(e); process.exit(1); });
