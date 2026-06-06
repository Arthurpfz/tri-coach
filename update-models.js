require('dotenv').config();
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' }
});

const WORKFLOWS = [
  { id: 'hrSGUqoAwkWQ4gKl', name: 'Daily Check-in (Intervals.icu)', from: 'anthropic/claude-sonnet-4.6' },
  { id: 'Q2KE0XGsc8NWLY8V', name: 'Daily Check-in (Strava legacy)', from: 'anthropic/claude-3.5-sonnet' },
  { id: 'lUcAtn2oxCPkNkJ1', name: 'Sunday Planner',                from: 'anthropic/claude-sonnet-4.6' }
];
const TARGET = 'anthropic/claude-sonnet-4.6';

// N8N public API only accepts: name, nodes, connections, settings, staticData
function sanitize(wf) {
  return {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
    staticData: wf.staticData || null
  };
}

(async () => {
  for (const w of WORKFLOWS) {
    try {
      const { data: wf } = await client.get(`/workflows/${w.id}`);
      let count = 0;
      for (const node of wf.nodes) {
        if (node.parameters?.model?.value === w.from) {
          node.parameters.model.value = TARGET;
          count++;
        } else if (node.parameters?.model === w.from) {
          node.parameters.model = TARGET;
          count++;
        }
      }
      console.log(`[${w.name}] replaced ${count} model ref(s)`);
      const body = sanitize(wf);
      await client.put(`/workflows/${w.id}`, body);
      console.log(`  ✅ PUT succeeded`);
    } catch (e) {
      console.log(`  ❌`, e.response?.status, JSON.stringify(e.response?.data || e.message));
    }
  }
})();
