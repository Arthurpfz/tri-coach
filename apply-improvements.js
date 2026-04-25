/**
 * apply-improvements.js
 *
 * Applies three agent-design improvements:
 *   Fix 2 — Daily Checkin: extract structured grade from Claude output
 *   Fix 1 — Sunday Planner: feed this week's sessions as context
 *   Fix 3 — Create Telegram Feedback Handler workflow
 */
require('dotenv').config();
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function getWorkflow(id) {
  return (await client.get(`/workflows/${id}`)).data;
}

function sanitize(wf) {
  return {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
    staticData: wf.staticData || null,
  };
}

async function putWorkflow(id, wf) {
  return (await client.put(`/workflows/${id}`, sanitize(wf))).data;
}

async function createWorkflow(data) {
  return (await client.post('/workflows', data)).data;
}

async function activateWorkflow(id) {
  return (await client.post(`/workflows/${id}/activate`)).data;
}

// ── Fix 2: Daily Checkin — grade extraction ───────────────────────────────────

async function fixDailyCheckin() {
  console.log('\n[Fix 2] Updating Daily Checkin (grade extraction)...');
  const wf = await getWorkflow('hrSGUqoAwkWQ4gKl');
  const nodes = JSON.parse(JSON.stringify(wf.nodes));
  const connections = JSON.parse(JSON.stringify(wf.connections));

  // 1. Update Hardcore Analysis prompt → output JSON with grade + message
  const llmNode = nodes.find(n => n.id === 'llm-chain');
  if (!llmNode) throw new Error('llm-chain node not found');

  const oldPrompt = llmNode.parameters.text;
  // Replace the trailing "Output the message:" with JSON output instruction
  llmNode.parameters.text = oldPrompt.replace(
    '\n\nOutput the message:',
    `\n\nOutput ONLY a JSON object. No markdown, no code blocks, no extra text whatsoever.
{"grade":"X","message":"<full message text with \\n for newlines>"}

Rules:
- grade is exactly one of: A, B, C, F (matching the Grade: line in the message)
- message is the complete Telegram text, same format as above, using \\n for line breaks
- Do NOT wrap in \`\`\`json\`\`\` code blocks`
  );

  // 2. Add Parse Grade node (Set node) between Hardcore Analysis and Save Analysis
  const parseGradeNode = {
    id: 'parse-grade-node',
    name: 'Parse Grade',
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position: [1880, 160],
    parameters: {
      assignments: {
        assignments: [
          {
            id: 'extract-grade',
            name: 'grade',
            value: "={{ (() => { try { const t = $json.text.replace(/```json[\\s\\S]*?```/g, s => s.replace(/```json\\s*/,'').replace(/```\\s*/,'')).replace(/```/g,'').trim(); return JSON.parse(t).grade || 'B'; } catch(e) { const m = $json.text.match(/Grade:\\s*([ABCF])/); return m ? m[1] : 'B'; } })() }}",
            type: 'string',
          },
          {
            id: 'extract-message',
            name: 'message',
            value: "={{ (() => { try { const t = $json.text.replace(/```json[\\s\\S]*?```/g, s => s.replace(/```json\\s*/,'').replace(/```\\s*/,'')).replace(/```/g,'').trim(); return JSON.parse(t).message || $json.text; } catch(e) { return $json.text; } })() }}",
            type: 'string',
          },
        ],
      },
      options: {},
    },
  };
  nodes.push(parseGradeNode);

  // 3. Move Send Telegram right to avoid visual overlap
  const sendTelegram = nodes.find(n => n.id === 'send-telegram');
  if (sendTelegram) {
    sendTelegram.position = [2240, 160];
    sendTelegram.parameters.text = '={{ $json.message }}';
  }

  // 4. Update Save Analysis: reference Parse Grade output, add grade field
  const saveAnalysis = nodes.find(n => n.id === 'save-analysis-node');
  if (saveAnalysis) {
    saveAnalysis.position = [2040, 160];
    const params = saveAnalysis.parameters.bodyParameters.parameters;
    // Update analysis field to use $json.message from Parse Grade
    const analysisParam = params.find(p => p.name === 'analysis');
    if (analysisParam) analysisParam.value = '={{ $json.message }}';
    // Add grade param if not already there
    if (!params.find(p => p.name === 'grade')) {
      params.push({ name: 'grade', value: '={{ $json.grade }}' });
    }
  }

  // 5. Rewire connections: Hardcore Analysis → Parse Grade → Save Analysis
  connections['Hardcore Analysis'] = {
    main: [[{ node: 'Parse Grade', type: 'main', index: 0 }]],
  };
  connections['Parse Grade'] = {
    main: [[{ node: 'Save Analysis', type: 'main', index: 0 }]],
  };
  // Save Analysis → Send Telegram stays as-is

  wf.nodes = nodes;
  wf.connections = connections;
  const result = await putWorkflow('hrSGUqoAwkWQ4gKl', wf);
  console.log('[Fix 2] Done. versionId:', result.versionId);
  return result;
}

// ── Fix 1: Sunday Planner — last week sessions ────────────────────────────────

async function fixSundayPlanner() {
  console.log('\n[Fix 1] Updating Sunday Planner (last week sessions)...');
  const wf = await getWorkflow('lUcAtn2oxCPkNkJ1');
  const nodes = JSON.parse(JSON.stringify(wf.nodes));
  const connections = JSON.parse(JSON.stringify(wf.connections));

  // 1. Shift all existing nodes right to make room for 2 new nodes
  for (const n of nodes) {
    if (n.id !== '9559b075-1d4d-499b-bf54-17c7e3e54541' && // Schedule Trigger stays
        n.id !== '40fd91b0-e028-43f3-b85a-a13429bc0de1') {  // Search records stays
      n.position = [n.position[0] + 520, n.position[1]];
    }
  }

  // 2. Add Get This Week Sessions node (uses wrap=1 so always returns one item)
  const getSessionsNode = {
    id: 'get-this-week-sessions',
    name: 'Get This Week Sessions',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [448, 0],
    parameters: {
      method: 'GET',
      url: 'https://coach-db.arthurpfz.com/sessions',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'athlete_id', value: "={{ $('Search records').item.json.id }}" },
          { name: 'date_from', value: "={{ $today.startOf('week').toFormat('yyyy-MM-dd') }}" },
          { name: 'limit', value: '14' },
          { name: 'wrap', value: '1' },
        ],
      },
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: {},
    },
    credentials: {
      httpHeaderAuth: { id: '6GNzKYNE1JAz77RL', name: 'Tricoach DB' },
    },
  };
  nodes.push(getSessionsNode);

  // 3. Add Build Prompt Context (Code node) — merges athlete + sessions
  const buildContextNode = {
    id: 'build-prompt-context',
    name: 'Build Prompt Context',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [688, 0],
    parameters: {
      jsCode: `const athlete = $('Search records').first().json;
const wrapped = $json; // {sessions: [...], count: N}
const sessions = Array.isArray(wrapped.sessions) ? wrapped.sessions : [];

const lines = [];
if (sessions.length === 0) {
  lines.push('No sessions logged this week.');
} else {
  const totalMin = sessions.reduce((s, x) => s + (x.duration_min || 0), 0);
  const totalTSS = sessions.reduce((s, x) => s + (parseFloat(x.tss) || 0), 0);
  const grades = sessions.filter(x => x.grade).map(x => x.grade);
  lines.push(sessions.length + ' session' + (sessions.length > 1 ? 's' : '') + ' · ' + (totalMin/60).toFixed(1) + 'h · TSS ' + Math.round(totalTSS));
  if (grades.length) lines.push('Session grades: ' + grades.join(', '));
  sessions.slice().reverse().forEach(s => {
    const p = [
      (s.date || '').slice(5),
      s.sport || '?',
      s.duration_min ? s.duration_min + 'min' : null,
      s.tss ? 'TSS ' + Math.round(s.tss) : null,
      s.grade ? 'Grade ' + s.grade : null,
    ].filter(Boolean).join(' · ');
    lines.push('  - ' + p);
  });
}

return [{ json: { ...athlete, lastWeekSummary: lines.join('\\n') } }];`,
    },
  };
  nodes.push(buildContextNode);

  // 4. Update the LLM prompt to include last week's execution section
  const llmNode = nodes.find(n => n.id === '70dbba47-5cce-4e10-ada8-d927fe63ac21');
  if (!llmNode) throw new Error('LLM node not found');

  const contextSection = `\n=== THIS WEEK'S EXECUTION ===\n{{ $json.lastWeekSummary }}\n`;
  const executionInstruction = `\n7. **Factor in this week's execution:** If sessions were graded C or F, or volume was low, adjust next week's load accordingly. If all A/B, you can stay the course or marginally increase within phase guidelines. If no sessions logged, plan conservatively.\n`;

  llmNode.parameters.text = llmNode.parameters.text
    .replace(
      '\n=== INSTRUCTIONS ===',
      contextSection + '\n=== INSTRUCTIONS ==='
    )
    .replace(
      '\n6. **Session structure:**',
      executionInstruction + '\n6. **Session structure:**'
    );

  // 5. Rewire: Search records → Get This Week Sessions → Build Prompt Context → Basic LLM Chain
  connections['Search records'] = {
    main: [[{ node: 'Get This Week Sessions', type: 'main', index: 0 }]],
  };
  connections['Get This Week Sessions'] = {
    main: [[{ node: 'Build Prompt Context', type: 'main', index: 0 }]],
  };
  connections['Build Prompt Context'] = {
    main: [[{ node: 'Basic LLM Chain', type: 'main', index: 0 }]],
  };

  wf.nodes = nodes;
  wf.connections = connections;
  const result = await putWorkflow('lUcAtn2oxCPkNkJ1', wf);
  console.log('[Fix 1] Done. versionId:', result.versionId);
  return result;
}

// ── Fix 3: Telegram Feedback Handler workflow ─────────────────────────────────

async function createFeedbackHandler() {
  console.log('\n[Fix 3] Creating Telegram Feedback Handler workflow...');

  const workflowData = {
    name: 'Coach Tri - Feedback Handler',
    nodes: [
      {
        id: 'telegram-trigger',
        name: 'Telegram Trigger',
        type: 'n8n-nodes-base.telegramTrigger',
        typeVersion: 1.1,
        position: [0, 0],
        parameters: {
          updates: ['message'],
          additionalFields: {},
        },
        credentials: {
          telegramApi: { id: '9IpAp35yJmIQJpeA', name: 'Telegram account' },
        },
        webhookId: 'feedback-handler-webhook',
      },
      {
        id: 'check-auth',
        name: 'Check Auth',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.3,
        position: [200, 0],
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
              {
                id: 'auth-check',
                leftValue: '={{ $json.message.chat.id.toString() }}',
                rightValue: 'TELEGRAM_CHAT_ID_REDACTED',
                operator: { type: 'string', operation: 'equals' },
              },
            ],
            combinator: 'and',
          },
          options: {},
        },
      },
      {
        id: 'is-feedback',
        name: 'Is Feedback?',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.3,
        position: [400, -100],
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
              {
                id: 'feedback-prefix',
                leftValue: '={{ $json.message.text }}',
                rightValue: '!',
                operator: { type: 'string', operation: 'startsWith' },
              },
            ],
            combinator: 'and',
          },
          options: {},
        },
      },
      {
        id: 'get-latest-session',
        name: 'Get Latest Session',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.3,
        position: [600, -100],
        parameters: {
          method: 'GET',
          url: 'https://coach-db.arthurpfz.com/sessions',
          sendQuery: true,
          queryParameters: {
            parameters: [
              { name: 'athlete_id', value: '1' },
              { name: 'limit', value: '1' },
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
      {
        id: 'check-session-exists',
        name: 'Session Exists?',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.3,
        position: [800, -100],
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [
              {
                id: 'session-check',
                leftValue: '={{ $json.count }}',
                rightValue: 0,
                operator: { type: 'number', operation: 'gt' },
              },
            ],
            combinator: 'and',
          },
          options: {},
        },
      },
      {
        id: 'save-feedback',
        name: 'Save Feedback',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.3,
        position: [1000, -160],
        parameters: {
          method: 'PATCH',
          url: "=https://coach-db.arthurpfz.com/sessions/{{ $json.sessions[0].id }}",
          authentication: 'genericCredentialType',
          genericAuthType: 'httpHeaderAuth',
          sendBody: true,
          contentType: 'json',
          bodyParameters: {
            parameters: [
              {
                name: 'user_feedback',
                value: "={{ $('Telegram Trigger').item.json.message.text.replace(/^!\\s*/, '').trim() }}",
              },
              {
                name: 'user_feedback_at',
                value: '={{ $now.toISO() }}',
              },
            ],
          },
          options: {},
        },
        credentials: {
          httpHeaderAuth: { id: '6GNzKYNE1JAz77RL', name: 'Tricoach DB' },
        },
      },
      {
        id: 'confirm-saved',
        name: 'Send Confirmation',
        type: 'n8n-nodes-base.telegram',
        typeVersion: 1.2,
        position: [1200, -160],
        parameters: {
          chatId: 'TELEGRAM_CHAT_ID_REDACTED',
          text: "=Got it — saved to {{ $('Get Latest Session').item.json.sessions[0].date }} {{ $('Get Latest Session').item.json.sessions[0].sport }} session.",
          additionalFields: { appendAttribution: false },
        },
        credentials: {
          telegramApi: { id: '9IpAp35yJmIQJpeA', name: 'Telegram account' },
        },
      },
      {
        id: 'no-session-reply',
        name: 'No Session Reply',
        type: 'n8n-nodes-base.telegram',
        typeVersion: 1.2,
        position: [1000, -40],
        parameters: {
          chatId: 'TELEGRAM_CHAT_ID_REDACTED',
          text: "No analyzed session found to attach feedback to.",
          additionalFields: { appendAttribution: false },
        },
        credentials: {
          telegramApi: { id: '9IpAp35yJmIQJpeA', name: 'Telegram account' },
        },
      },
    ],
    connections: {
      'Telegram Trigger': {
        main: [[{ node: 'Check Auth', type: 'main', index: 0 }]],
      },
      'Check Auth': {
        main: [
          [{ node: 'Is Feedback?', type: 'main', index: 0 }], // true
          [], // false — ignore unauthorized
        ],
      },
      'Is Feedback?': {
        main: [
          [{ node: 'Get Latest Session', type: 'main', index: 0 }], // true
          [], // false — not a feedback message, ignore
        ],
      },
      'Get Latest Session': {
        main: [[{ node: 'Session Exists?', type: 'main', index: 0 }]],
      },
      'Session Exists?': {
        main: [
          [{ node: 'Save Feedback', type: 'main', index: 0 }], // true
          [{ node: 'No Session Reply', type: 'main', index: 0 }], // false
        ],
      },
      'Save Feedback': {
        main: [[{ node: 'Send Confirmation', type: 'main', index: 0 }]],
      },
    },
    settings: {
      executionOrder: 'v1',
      errorWorkflow: 'psyVgPiGJoO5QOa4',
    },
  };

  const result = await createWorkflow(workflowData);
  console.log('[Fix 3] Created workflow:', result.id, result.name);
  console.log('[Fix 3] Activating...');
  const activated = await activateWorkflow(result.id);
  console.log('[Fix 3] Active:', activated.active, 'id:', result.id);
  return result;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const step = process.argv[2]; // 'all' | '1' | '2' | '3'
  try {
    if (!step || step === 'all' || step === '2') await fixDailyCheckin();
    if (!step || step === 'all' || step === '1') await fixSundayPlanner();
    if (!step || step === 'all' || step === '3') await createFeedbackHandler();
    console.log('\nAll requested improvements applied.');
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
}

main();
