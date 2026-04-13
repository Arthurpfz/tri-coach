const axios = require('axios');

// Intervals.icu API credentials
const ATHLETE_ID = 'i492254';
const API_KEY = 'INTERVALS_API_KEY_REDACTED';
const BASE_URL = 'https://intervals.icu/api/v1';

// Create axios instance with Basic Auth
const client = axios.create({
  baseURL: BASE_URL,
  auth: {
    username: 'API_KEY',
    password: API_KEY
  },
  headers: {
    'Accept': 'application/json'
  }
});

async function testConnection() {
  console.log('🧪 Testing Intervals.icu API Connection...\n');
  console.log('Athlete ID:', ATHLETE_ID);
  console.log('API Key:', API_KEY.substring(0, 8) + '...\n');

  try {
    // Test 1: Get athlete info
    console.log('Test 1: Fetching athlete profile...');
    const athleteResponse = await client.get(`/athlete/${ATHLETE_ID}`);
    console.log('✅ Profile fetched successfully!');
    console.log('   Name:', athleteResponse.data.name);
    console.log('   Sport:', athleteResponse.data.sport);
    console.log('   Gender:', athleteResponse.data.sex);
    console.log('');

    // Test 2: Get recent activities (last 7 days)
    console.log('Test 2: Fetching recent activities...');
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const activitiesResponse = await client.get(`/athlete/${ATHLETE_ID}/activities`, {
      params: {
        oldest: sevenDaysAgo.toISOString().split('T')[0],
        newest: today.toISOString().split('T')[0]
      }
    });

    const activities = activitiesResponse.data;
    console.log(`✅ Found ${activities.length} activities in the last 7 days\n`);

    if (activities.length > 0) {
      console.log('Recent activities:');
      activities.slice(0, 5).forEach((activity, index) => {
        const date = new Date(activity.start_date_local).toLocaleDateString();
        const duration = Math.round(activity.moving_time / 60);
        console.log(`   ${index + 1}. ${activity.type} - ${date} (${duration} min)`);
        if (activity.avg_watts) console.log(`      Power: ${Math.round(activity.avg_watts)}W avg`);
        if (activity.avg_hr) console.log(`      HR: ${Math.round(activity.avg_hr)}bpm avg`);
        if (activity.training_load) console.log(`      TSS: ${Math.round(activity.training_load)}`);
      });
      console.log('');

      // Test 3: Get detailed activity data for the most recent activity
      const latestActivity = activities[0];
      console.log('Test 3: Fetching detailed activity data...');
      console.log(`   Activity: ${latestActivity.type} - ${new Date(latestActivity.start_date_local).toLocaleDateString()}\n`);

      const detailResponse = await client.get(`/activity/${latestActivity.id}`);
      const detail = detailResponse.data;

      console.log('✅ Detailed activity fetched successfully!');
      console.log('   Available data:');
      console.log('   - Duration:', Math.round(detail.moving_time / 60), 'min');
      console.log('   - Distance:', (detail.distance / 1000).toFixed(2), 'km');
      if (detail.avg_watts) console.log('   - Avg Power:', Math.round(detail.avg_watts), 'W');
      if (detail.weighted_avg_watts) console.log('   - Normalized Power:', Math.round(detail.weighted_avg_watts), 'W');
      if (detail.variability_index) console.log('   - Variability Index:', detail.variability_index.toFixed(2));
      if (detail.avg_hr) console.log('   - Avg HR:', Math.round(detail.avg_hr), 'bpm');
      if (detail.avg_cadence) console.log('   - Avg Cadence:', Math.round(detail.avg_cadence));
      if (detail.avg_run_cadence) console.log('   - Avg Run Cadence:', Math.round(detail.avg_run_cadence), 'spm');
      if (detail.training_load) console.log('   - TSS:', Math.round(detail.training_load));
      if (detail.intensity) console.log('   - Intensity Factor:', detail.intensity.toFixed(2));

      console.log('\n   Available streams:', detail.streams_types?.join(', ') || 'None');

      // Test 4: Check if streams data is available
      if (detail.streams_types && detail.streams_types.length > 0) {
        console.log('\n✅ Streams data is available! This activity has time-series data for:');
        detail.streams_types.forEach(stream => {
          console.log(`   - ${stream}`);
        });
        console.log('\n   We can use this for detailed technical analysis!');
      }

      console.log('\n🎉 All tests passed! Ready to build the workflow.\n');

      // Save sample activity for reference
      const fs = require('fs');
      fs.writeFileSync('sample-activity-intervals-icu.json', JSON.stringify(detail, null, 2));
      console.log('📄 Sample activity saved to: sample-activity-intervals-icu.json\n');

    } else {
      console.log('⚠️  No activities found in the last 7 days.');
      console.log('   This is okay - the workflow will handle empty results gracefully.\n');
    }

  } catch (error) {
    console.error('❌ Error testing API connection:');
    console.error('   Status:', error.response?.status);
    console.error('   Message:', error.response?.data || error.message);
    console.error('\n   Please check:');
    console.error('   1. API key is correct');
    console.error('   2. Athlete ID is correct');
    console.error('   3. API key has not expired\n');
  }
}

testConnection();
