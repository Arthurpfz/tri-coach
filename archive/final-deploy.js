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

const fs = require('fs');
const workflow = JSON.parse(fs.readFileSync('intervals-icu-workflow-hardcore.json', 'utf8'));

async function deploy() {
  console.log('🔥 DEPLOYING HARDCORE MODE WORKFLOW\n');

  try {
    const response = await client.post('/workflows', workflow);

    console.log('✅ WORKFLOW CREATED!');
    console.log('   ID:', response.data.id);
    console.log('   Name:', response.data.name);
    console.log('\n📋 ACTIVATION REQUIRED:');
    console.log('   1. Go to: https://apfz.app.n8n.cloud/workflow/' + response.data.id);
    console.log('   2. Click the "Inactive" toggle in top right');
    console.log('   3. Workflow will run daily at 20:10 Berlin time');
    console.log('\n🔥 HARDCORE MODE SPECS:');
    console.log('   - Model: Claude 3.7 Sonnet');
    console.log('   - Schedule: Daily 20:10 (Europe/Berlin)');
    console.log('   - Data: Full FIT file metrics from Intervals.icu');
    console.log('   - Analysis: Comprehensive technical deep-dive');
    console.log('   - Output: 6-10 sentence coaching message\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

deploy();
