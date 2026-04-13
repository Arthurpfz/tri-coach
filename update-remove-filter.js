const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_BASE_URL = 'https://apfz.app.n8n.cloud/api/v1';
const OLD_ID = '1IFMn9sjPXwX7APq';

const client = axios.create({
  baseURL: N8N_BASE_URL,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function update() {
  console.log('Removing Strava filter from workflow...\n');

  try {
    await client.delete(`/workflows/${OLD_ID}`);
    console.log('✅ Deleted old version');
    
    const workflow = JSON.parse(fs.readFileSync('intervals-icu-workflow.json', 'utf8'));
    const response = await client.post('/workflows', workflow);
    
    console.log('✅ Updated workflow!');
    console.log('   ID:', response.data.id);
    console.log('   Name:', response.data.name);
    console.log('\n🔧 Changes:');
    console.log('   - Removed "Filter Out Strava" node');
    console.log('   - Now analyzes ALL activities (including Strava-sourced)');
    console.log('   - Simpler workflow, more comprehensive analysis');
    console.log('\n   Activate at: https://apfz.app.n8n.cloud/workflow/' + response.data.id);
    
    require('child_process').exec(`open "https://apfz.app.n8n.cloud/workflow/${response.data.id}"`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

update();
