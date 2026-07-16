// 🎓 Explain & drills — inline button on analysis messages + callback branch in Feedback Handler
// 1) Feedback Handler (gAnJ0r3x0sFxqWxY): listen to callback_query, new explain branch
// 2) Daily Checkin (hrSGUqoAwkWQ4gKl) + Backfill (rHIyZMIJNAOqZvM2): 🎓 button on Send Telegram
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

async function putWorkflow(wf) {
  return api('PUT', `/workflows/${wf.id}`, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings,
  });
}

const CHAT_ALLOWLIST = '1865798034';
const DB = 'https://coach-db.arthurpfz.com';
const DB_CRED = { httpHeaderAuth: { id: '6GNzKYNE1JAz77RL', name: 'Tricoach DB' } };
const TG_CRED = { telegramApi: { id: '9IpAp35yJmIQJpeA', name: 'Telegram account' } };
const OR_CRED = { openRouterApi: { id: 'nhbNqmgyP4cAeQ6B', name: 'OpenRouter account' } };

const BUILD_PROMPT_CODE = `const s = $('Get Explain Session').first().json;
const athlete = $input.first().json;
if (!s || s.error || !s.id) return [{ json: { notFound: true } }];

const isRun = (s.sport || '').toLowerCase().includes('run');
const fmt = (v, d = 1) => (v === null || v === undefined) ? null : Number(v).toFixed(d);
const met = [];
if (s.avg_hr) met.push('avg HR ' + s.avg_hr + 'bpm');
if (s.avg_power) met.push('avg power ' + s.avg_power + 'W');
if (s.normalized_power) met.push('NP ' + s.normalized_power + 'W');
if (s.avg_cadence) met.push('avg cadence ' + (isRun ? (s.avg_cadence * 2) + ' spm' : s.avg_cadence + ' rpm'));
if (s.avg_speed_ms) met.push('avg speed ' + fmt(s.avg_speed_ms, 2) + ' m/s');
if (s.tss) met.push('TSS ' + s.tss);
if (s.intensity_factor) met.push('IF ' + s.intensity_factor);
if (s.decoupling !== null && s.decoupling !== undefined) met.push('decoupling ' + fmt(s.decoupling) + '%');
if (s.efficiency_factor !== null && s.efficiency_factor !== undefined) met.push('EF ' + fmt(s.efficiency_factor, 2));
if (s.pool_length_m) met.push('pool ' + s.pool_length_m + 'm');

const lines = [
  'Sport: ' + s.sport + ' · Date: ' + s.date + ' · Grade: ' + (s.grade || '—'),
  'Duration: ' + (s.duration_min || '—') + 'min · Distance: ' + (s.distance_km ?? '—') + 'km',
];
if (met.length) lines.push('Metrics: ' + met.join(' · '));
lines.push('', 'COACH ANALYSIS (the message the athlete tapped):', s.analysis || '(no stored analysis — explain from the metrics alone)');
lines.push('', 'ATHLETE FITNESS PROFILE:', athlete['Fitness Profile'] || '');
return [{ json: { notFound: false, context: lines.join('\\n') } }];`;

const EXPLAIN_PROMPT = `=You are a triathlon coach. Your athlete tapped "Explain" under the coaching analysis below and wants it decoded in PLAIN ENGLISH — they are not a sports scientist. Race: Erkner 70.3 on 2026-09-13 (1.9km swim, 90km bike, 21.1km run).

{{ $json.context }}

Write the Telegram reply. ENGLISH ONLY. Plain text, no markdown, literal • bullets and numbered list, max ~20 lines total. Exactly this structure:

🧠 What it means
2-4 • bullets translating the analysis for a non-expert: decode every metric it names (what it measures, what their number says vs the target), then the single limiter and why it matters for their race.

💪 Best exercises to improve
3-5 numbered drills/exercises that most directly fix the limiter, highest-leverage first. Each: name — what it fixes, how to do it (max 2 lines). Sport-appropriate: swim → stroke/technique drills; run → cadence, strides, form work; ride → pacing, cadence, durability work. Use the fitness profile numbers for targets.

Do: one closing line telling them exactly how to fold this into their next session.

No preamble, no sign-off, simple words, never French.`;

function explainNodes() {
  return [
    {
      name: 'Is Callback?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [200, -200],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{
            id: 'is-callback',
            leftValue: `={{ ($json.callback_query?.data || "").startsWith("explain:") && ($json.callback_query?.from?.id || "").toString() === "${CHAT_ALLOWLIST}" }}`,
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          }],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      name: 'Answer Callback', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [420, -300],
      parameters: {
        resource: 'callback',
        operation: 'answerQuery',
        queryId: "={{ $json.callback_query.id }}",
        additionalFields: {},
      },
      credentials: TG_CRED,
    },
    {
      name: 'Get Explain Session', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [640, -300],
      parameters: {
        method: 'GET',
        url: `=${DB}/sessions/{{ $('Telegram Trigger').item.json.callback_query.data.split(':')[1] }}`,
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        options: { response: { response: { neverError: true } } },
      },
      credentials: DB_CRED,
    },
    {
      name: 'Get Explain Athlete', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [860, -300],
      parameters: {
        method: 'GET',
        url: `${DB}/athletes/1`,
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        options: {},
      },
      credentials: DB_CRED,
    },
    {
      name: 'Build Explain Prompt', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1080, -300],
      parameters: { jsCode: BUILD_PROMPT_CODE },
    },
    {
      name: 'Session Found?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1300, -300],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{
            id: 'session-found',
            leftValue: '={{ $json.notFound !== true }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          }],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      name: 'Explain Coach', type: '@n8n/n8n-nodes-langchain.chainLlm', typeVersion: 1.8, position: [1520, -360],
      parameters: { promptType: 'define', text: EXPLAIN_PROMPT, batching: {} },
    },
    {
      name: 'Explain Model', type: '@n8n/n8n-nodes-langchain.lmChatOpenRouter', typeVersion: 1, position: [1560, -180],
      parameters: { model: 'anthropic/claude-sonnet-4.6', options: {} },
      credentials: OR_CRED,
    },
    {
      name: 'Send Explanation', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [1880, -360],
      parameters: {
        chatId: "={{ $('Telegram Trigger').item.json.callback_query.message.chat.id.toString() }}",
        text: "={{ ($json.text || '').trim() }}",
        additionalFields: {
          appendAttribution: false,
          reply_to_message_id: "={{ $('Telegram Trigger').item.json.callback_query.message.message_id }}",
        },
      },
      credentials: TG_CRED,
    },
    {
      name: 'Explain Not Found', type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: [1520, -120],
      parameters: {
        chatId: "={{ $('Telegram Trigger').item.json.callback_query.message.chat.id.toString() }}",
        text: "🤷 Couldn't find that session in the DB.",
        additionalFields: { appendAttribution: false },
      },
      credentials: TG_CRED,
    },
  ];
}

async function updateFeedbackHandler() {
  const wf = await api('GET', '/workflows/gAnJ0r3x0sFxqWxY');

  // 1. Trigger: also receive callback_query
  const trigger = wf.nodes.find(n => n.name === 'Telegram Trigger');
  trigger.parameters.updates = ['message', 'callback_query'];

  // 2. Check Auth: don't throw on updates without .message
  const auth = wf.nodes.find(n => n.name === 'Check Auth');
  auth.parameters.conditions.conditions[0].leftValue = "={{ $json.message?.chat?.id?.toString() || \"\" }}";

  // 3. New nodes (idempotent: drop any previous copies first)
  const newNames = new Set(explainNodes().map(n => n.name));
  wf.nodes = wf.nodes.filter(n => !newNames.has(n.name)).concat(explainNodes());

  // 4. Wiring: Trigger → Is Callback? →(true) Answer Callback …; (false)→ Check Auth
  wf.connections['Telegram Trigger'] = { main: [[{ node: 'Is Callback?', type: 'main', index: 0 }]] };
  wf.connections['Is Callback?'] = {
    main: [
      [{ node: 'Answer Callback', type: 'main', index: 0 }],
      [{ node: 'Check Auth', type: 'main', index: 0 }],
    ],
  };
  wf.connections['Answer Callback'] = { main: [[{ node: 'Get Explain Session', type: 'main', index: 0 }]] };
  wf.connections['Get Explain Session'] = { main: [[{ node: 'Get Explain Athlete', type: 'main', index: 0 }]] };
  wf.connections['Get Explain Athlete'] = { main: [[{ node: 'Build Explain Prompt', type: 'main', index: 0 }]] };
  wf.connections['Build Explain Prompt'] = { main: [[{ node: 'Session Found?', type: 'main', index: 0 }]] };
  wf.connections['Session Found?'] = {
    main: [
      [{ node: 'Explain Coach', type: 'main', index: 0 }],
      [{ node: 'Explain Not Found', type: 'main', index: 0 }],
    ],
  };
  wf.connections['Explain Model'] = { ai_languageModel: [[{ node: 'Explain Coach', type: 'ai_languageModel', index: 0 }]] };
  wf.connections['Explain Coach'] = { main: [[{ node: 'Send Explanation', type: 'main', index: 0 }]] };

  const res = await putWorkflow(wf);
  console.log(`Feedback Handler updated — active=${res.active}, nodes=${res.nodes.length}`);
}

async function addButton(workflowId, label) {
  const wf = await api('GET', `/workflows/${workflowId}`);
  const send = wf.nodes.find(n => n.name === 'Send Telegram');
  send.parameters.replyMarkup = 'inlineKeyboard';
  send.parameters.inlineKeyboard = {
    rows: [{
      row: {
        buttons: [{
          text: '🎓 Explain & drills',
          additionalFields: { callback_data: "=explain:{{ $('Save Session').item.json.id }}" },
        }],
      },
    }],
  };
  const res = await putWorkflow(wf);
  console.log(`${label} updated — active=${res.active}`);
}

(async () => {
  await updateFeedbackHandler();
  await addButton('hrSGUqoAwkWQ4gKl', 'Daily Checkin');
  await addButton('rHIyZMIJNAOqZvM2', 'Backfill');
})().catch(e => { console.error(e); process.exit(1); });
