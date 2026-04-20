require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const client = axios.create({
  baseURL: process.env.N8N_API_URL,
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
});
(async () => {
  const { data: wf } = await client.get('/workflows/hrSGUqoAwkWQ4gKl');
  for (const n of wf.nodes) {
    if (n.type?.includes('langchain') || n.type?.includes('agent') || n.type?.includes('chainLlm') || n.parameters?.messages || n.parameters?.text || n.parameters?.prompt) {
      console.log('=== NODE:', n.name, '('+n.type+') ===');
      console.log(JSON.stringify(n.parameters, null, 2).slice(0, 6000));
      console.log();
    }
  }
})();
