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

async function recreateCredential() {
  console.log('Recreating Intervals.icu credential...\n');

  try {
    // Delete old credential
    try {
      await client.delete('/credentials/LeGFB4Wmg015clTL');
      console.log('✅ Deleted old credential');
    } catch (e) {
      console.log('Old credential not found, creating new one...');
    }

    // Create fresh credential
    const credential = {
      name: "Intervals.icu API",
      type: "httpBasicAuth",
      data: {
        user: "API_KEY",
        password: "INTERVALS_API_KEY_REDACTED"
      }
    };

    const response = await client.post('/credentials', credential);
    console.log('✅ Created new credential!');
    console.log('   ID:', response.data.id);
    console.log('   Name:', response.data.name);
    console.log('   Type:', response.data.type);
    console.log('\nNow go back to the workflow and:');
    console.log('1. Click "Get Activities" node');
    console.log('2. In Authentication, select "Intervals.icu API"');
    console.log('3. Click "Get Activity Details" node');
    console.log('4. In Authentication, select "Intervals.icu API"');
    console.log('5. Test the workflow\n');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

recreateCredential();
