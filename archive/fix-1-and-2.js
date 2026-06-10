/**
 * fix-1-and-2.js
 *
 * Fix 1: Add Limit (max 1) node between Call Backfill and Refresh Done in
 *        Feedback Handler so "✅ Refresh complete." fires once, not per session.
 * Fix 2: Add moving_time >= 600 (10min) to Filter Activities in both
 *        Daily Checkin and Backfill so warmup spins / dead recordings are
 *        dropped before analysis.
 */
require('dotenv').config({ path: '/Users/arthurpfalzgraf/Desktop/Projects/TRI COACH/.env' });
const axios = require('axios');

const n8n = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
});

function sanitize(wf) {
  return {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
    staticData: wf.staticData || null,
  };
}

async function fixFeedbackHandler() {
  const id = 'gAnJ0r3x0sFxqWxY';
  console.log(`\n[Fix 1] Feedback Handler ${id}`);
  const { data: wf } = await n8n.get(`/workflows/${id}`);

  if (wf.nodes.find(n => n.name === 'Limit Refresh Done')) {
    console.log('  Limit node already present — skipping.');
    return;
  }

  const callBackfill = wf.nodes.find(n => n.name === 'Call Backfill');
  if (!callBackfill) throw new Error('Call Backfill not found');

  const limitNode = {
    id: 'limit-refresh-done',
    name: 'Limit Refresh Done',
    type: 'n8n-nodes-base.limit',
    typeVersion: 1,
    position: [callBackfill.position[0] + 200, callBackfill.position[1]],
    parameters: { maxItems: 1, keep: 'firstItems' },
  };
  wf.nodes.push(limitNode);

  // Rewire: Call Backfill → Limit Refresh Done → Refresh Done
  wf.connections['Call Backfill'] = {
    main: [[{ node: 'Limit Refresh Done', type: 'main', index: 0 }]],
  };
  wf.connections['Limit Refresh Done'] = {
    main: [[{ node: 'Refresh Done', type: 'main', index: 0 }]],
  };

  const { data: result } = await n8n.put(`/workflows/${id}`, sanitize(wf));
  console.log(`  PUT ok. versionId: ${result.versionId}`);
  console.log(`  URL: https://apfz.app.n8n.cloud/workflow/${id}`);
}

async function fixFilterActivities(workflowId, label) {
  console.log(`\n[Fix 2] ${label} ${workflowId} — Filter Activities`);
  const { data: wf } = await n8n.get(`/workflows/${workflowId}`);
  const filter = wf.nodes.find(n => n.name === 'Filter Activities');
  if (!filter) throw new Error(`Filter Activities not found in ${workflowId}`);

  const conds = filter.parameters.conditions.conditions;
  if (conds.find(c => c.id === 'drop-short')) {
    console.log('  Short-session filter already present — skipping.');
    return;
  }

  conds.push({
    id: 'drop-short',
    leftValue: '={{ $json.moving_time }}',
    rightValue: 600,
    operator: { type: 'number', operation: 'gte' },
  });

  const { data: result } = await n8n.put(`/workflows/${workflowId}`, sanitize(wf));
  console.log(`  PUT ok. versionId: ${result.versionId}`);
  console.log(`  URL: https://apfz.app.n8n.cloud/workflow/${workflowId}`);
}

(async () => {
  try {
    await fixFeedbackHandler();
    await fixFilterActivities('hrSGUqoAwkWQ4gKl', 'Daily Checkin');
    await fixFilterActivities('rHIyZMIJNAOqZvM2', 'Backfill');
    console.log('\nDone. Drafts updated; activate in n8n UI if needed.');
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
})();
