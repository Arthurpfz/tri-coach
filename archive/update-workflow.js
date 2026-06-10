const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_BASE_URL = 'https://apfz.app.n8n.cloud/api/v1';
const WORKFLOW_ID = 'GkCUladuCe95T5fb';

const client = axios.create({
  baseURL: N8N_BASE_URL,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function updateWorkflow() {
  console.log('Fixing Telegram message...\n');

  try {
    // Get current workflow
    const current = await client.get(`/workflows/${WORKFLOW_ID}`);
    
    // Load fixed version
    const fixed = JSON.parse(fs.readFileSync('intervals-icu-workflow-hardcore.json', 'utf8'));
    
    // Delete old one
    await client.delete(`/workflows/${WORKFLOW_ID}`);
    console.log('✅ Deleted old version');
    
    // Create new one
    const response = await client.post('/workflows', fixed);
    console.log('✅ Created fixed version');
    console.log('   ID:', response.data.id);
    console.log('\n🔧 Fixed: Removed emoji prefix from Telegram message');
    console.log('   Activate at: https://apfz.app.n8n.cloud/workflow/' + response.data.id);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

updateWorkflow();
