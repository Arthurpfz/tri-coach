const axios = require('axios');
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

// Load the hardcore workflow
const fs = require('fs');
const workflow = JSON.parse(fs.readFileSync('intervals-icu-workflow-hardcore.json', 'utf8'));

async function deploy() {
  console.log('🔥 DEPLOYING HARDCORE MODE WORKFLOW...\n');

  try {
    // Create the workflow
    console.log('Creating workflow:', workflow.name);
    const response = await client.post('/workflows', workflow);

    console.log('✅ Workflow created successfully!');
    console.log('   ID:', response.data.id);
    console.log('   Name:', response.data.name);
    console.log('   Active:', response.data.active);

    const workflowId = response.data.id;
    console.log('🔥 HARDCORE MODE ENABLED 🔥');
    console.log('   Schedule: Daily at 20:10 (Europe/Berlin)');
    console.log('   Model: Claude Opus 4.5');
    console.log('   Analysis: Comprehensive technical deep-dive');
    console.log('   Streams: Full FIT file data\n');

    return workflowId;
  } catch (error) {
    console.error('❌ Error deploying workflow:');
    console.error('   Status:', error.response?.status);
    console.error('   Error:', error.response?.data);
    throw error;
  }
}

deploy().catch(console.error);
