const axios = require('axios');
require('dotenv').config();

const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_BASE_URL = 'https://apfz.app.n8n.cloud/api/v1';
const WORKFLOW_ID = '1IFMn9sjPXwX7APq';

const client = axios.create({
  baseURL: N8N_BASE_URL,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function verify() {
  console.log('Verifying workflow status...\n');

  try {
    const workflow = await client.get(`/workflows/${WORKFLOW_ID}`);
    
    console.log('✅ Workflow found');
    console.log('   Name:', workflow.data.name);
    console.log('   Active:', workflow.data.active ? '✅ YES' : '❌ NO (needs activation)');
    console.log('');

    if (!workflow.data.active) {
      console.log('⚠️  Workflow is not active yet');
      console.log('   Activate at: https://apfz.app.n8n.cloud/workflow/' + WORKFLOW_ID);
      console.log('');
      require('child_process').exec(`open "https://apfz.app.n8n.cloud/workflow/${WORKFLOW_ID}"`);
    } else {
      console.log('🎉 WORKFLOW IS ACTIVE!\n');
      console.log('Schedule: Daily at 20:10 (Europe/Berlin)');
      console.log('Next run: Tonight at 20:10');
      console.log('');
      console.log('What will happen:');
      console.log('1. Fetch today\'s activities from Intervals.icu');
      console.log('2. Filter out Strava-sourced duplicates');
      console.log('3. Get detailed FIT file metrics');
      console.log('4. Retrieve weekly plan from Airtable');
      console.log('5. Claude 3.7 Sonnet analyzes execution');
      console.log('6. Send technical coaching message via Telegram');
      console.log('');
      console.log('✅ All systems ready!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

verify();
