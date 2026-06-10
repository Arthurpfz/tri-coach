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
  console.log('🔥 HARDCORE MODE DEPLOYMENT\n');

  try {
    // Delete the inactive one
    console.log('Deleting inactive workflow tEvcvTx2NTKB2mw0...');
    try {
      await client.delete('/workflows/tEvcvTx2NTKB2mw0');
      console.log('✅ Deleted\n');
    } catch (e) {
      console.log('Already deleted or not found\n');
    }

    // Create with active:true
    console.log('Creating workflow with active:true...');
    const response = await client.post('/workflows', workflow);

    console.log('✅ DEPLOYED!');
    console.log('   ID:', response.data.id);
    console.log('   Name:', response.data.name);
    console.log('   Active:', response.data.active);
    console.log('\n🔥 HARDCORE MODE ENABLED 🔥');
    console.log('   Schedule: Daily at 20:10 (Europe/Berlin)');
    console.log('   Model: Claude 3.7 Sonnet');
    console.log('   Analysis: Full technical deep-dive');
    console.log('   Next run: Tonight at 20:10\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

deploy().catch(console.error);
