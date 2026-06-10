require('dotenv').config();
const axios = require('axios');
const client = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
});
const ids = {
  'Daily Check-in (Intervals.icu)': 'hrSGUqoAwkWQ4gKl',
  'Daily Check-in (Strava legacy)': 'Q2KE0XGsc8NWLY8V',
  'Sunday Planner': 'lUcAtn2oxCPkNkJ1'
};
(async () => {
  for (const [name, id] of Object.entries(ids)) {
    const { data: wf } = await client.get(`/workflows/${id}`);
    const models = wf.nodes
      .map(n => n.parameters?.model?.value ?? n.parameters?.model)
      .filter(m => typeof m === 'string' && m.includes('claude'));
    console.log(`[${name}] active=${wf.active} model=${models.join(', ')}`);
  }
})();
