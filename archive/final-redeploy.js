const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_BASE_URL = 'https://apfz.app.n8n.cloud/api/v1';

const client = axios.create({
  baseURL: N8N_BASE_URL,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function redeploy() {
  console.log('Final deployment with correct credential ID...\n');

  try {
    await client.delete('/workflows/p4diir1O3dRzb0U8');
    console.log('✅ Deleted old workflow');
    
    const workflow = JSON.parse(fs.readFileSync('intervals-icu-workflow.json', 'utf8'));
    const response = await client.post('/workflows', workflow);
    
    console.log('✅ Deployed with correct credential!');
    console.log('   ID:', response.data.id);
    console.log('   Credential ID: JBZzr0E5U1GSy6OQ');
    console.log('\n   Activate: https://apfz.app.n8n.cloud/workflow/' + response.data.id);
    
    require('child_process').exec(`open "https://apfz.app.n8n.cloud/workflow/${response.data.id}"`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

redeploy();
