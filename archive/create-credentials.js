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

async function createCredentials() {
  console.log('Creating Intervals.icu credentials...\n');

  const credential = {
    name: "Intervals.icu API",
    type: "httpBasicAuth",
    data: {
      user: "API_KEY",
      password: "INTERVALS_API_KEY_REDACTED"
    }
  };

  try {
    const response = await client.post('/credentials', credential);
    console.log('✅ Credentials created!');
    console.log('   ID:', response.data.id);
    console.log('   Name:', response.data.name);
    console.log('   Type:', response.data.type);
    
    // Now update the workflow to use this credential ID
    return response.data.id;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.log('\nManual creation required:');
    console.log('1. Go to: https://apfz.app.n8n.cloud/credentials');
    console.log('2. Click "Add Credential"');
    console.log('3. Select "HTTP Basic Auth"');
    console.log('4. Name: Intervals.icu API');
    console.log('5. User: API_KEY');
    console.log('6. Password: INTERVALS_API_KEY_REDACTED');
    console.log('7. Save');
  }
}

createCredentials();
