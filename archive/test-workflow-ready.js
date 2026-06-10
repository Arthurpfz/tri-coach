const axios = require('axios');
require('dotenv').config();

const INTERVALS_ATHLETE_ID = 'i492254';
const INTERVALS_API_KEY = 'INTERVALS_API_KEY_REDACTED';

const intervalsClient = axios.create({
  baseURL: 'https://intervals.icu/api/v1',
  auth: {
    username: 'API_KEY',
    password: INTERVALS_API_KEY
  },
  headers: {
    'Accept': 'application/json'
  }
});

async function testReady() {
  console.log('Testing Intervals.icu API access...\n');

  try {
    // Test the exact endpoint the workflow will use
    const today = new Date().toISOString().split('T')[0];

    console.log(`Fetching activities for ${today}...`);
    console.log(`URL: https://intervals.icu/api/v1/athlete/${INTERVALS_ATHLETE_ID}/activities?oldest=${today}&newest=${today}\n`);

    const response = await intervalsClient.get(`/athlete/${INTERVALS_ATHLETE_ID}/activities`, {
      params: {
        oldest: today,
        newest: today
      }
    });

    console.log('✅ API call successful!');
    console.log(`   Found ${response.data.length} activity/activities today\n`);

    if (response.data.length > 0) {
      console.log('Today\'s activities:');
      response.data.forEach((activity, i) => {
        console.log(`   ${i + 1}. ${activity.type || 'Unknown'} - ${activity.name || 'Unnamed'}`);
        console.log(`      Source: ${activity.source || 'Direct upload'}`);
        console.log(`      Duration: ${Math.round(activity.moving_time / 60)}min`);
      });
      console.log('');
    }

    console.log('🎉 Ready for workflow activation!\n');
    console.log('Next steps:');
    console.log('1. Add the two fields to Airtable Users table (if not done)');
    console.log('2. Activate the workflow: https://apfz.app.n8n.cloud/workflow/1IFMn9sjPXwX7APq');
    console.log('3. Wait for tonight at 20:10 Berlin time\n');

  } catch (error) {
    console.error('❌ API Error:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data || error.message);
    console.log('\nCommon issues:');
    console.log('- 401: Invalid API key');
    console.log('- 404: Invalid athlete ID or endpoint');
    console.log('- Check: https://intervals.icu/settings (Developer Settings)\n');
  }
}

testReady();
