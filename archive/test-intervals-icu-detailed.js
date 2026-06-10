const axios = require('axios');
const fs = require('fs');

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

async function findNonStravaActivity() {
  console.log('🔍 Looking for activities uploaded directly to Intervals.icu...\n');

  try {
    // Get last 30 days of activities
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const activitiesResponse = await client.get(`/athlete/${ATHLETE_ID}/activities`, {
      params: {
        oldest: thirtyDaysAgo.toISOString().split('T')[0],
        newest: today.toISOString().split('T')[0]
      }
    });

    const activities = activitiesResponse.data;
    console.log(`Found ${activities.length} activities in last 30 days\n`);

    // Filter out Strava activities
    const nonStravaActivities = activities.filter(a => a.source !== 'STRAVA');
    console.log(`Non-Strava activities: ${nonStravaActivities.length}\n`);

    if (nonStravaActivities.length > 0) {
      console.log('Activities uploaded directly to Intervals.icu:');
      nonStravaActivities.slice(0, 10).forEach((activity, index) => {
        const date = new Date(activity.start_date_local).toLocaleDateString();
        const duration = activity.moving_time ? Math.round(activity.moving_time / 60) : '?';
        console.log(`   ${index + 1}. ${activity.type || 'Unknown'} - ${date} (${duration} min)`);
        console.log(`      Source: ${activity.source || 'Unknown'}`);
        console.log(`      ID: ${activity.id}`);
      });

      // Get detailed data for the first non-Strava activity
      const sampleActivity = nonStravaActivities[0];
      console.log(`\n📥 Fetching detailed data for: ${sampleActivity.type} (${new Date(sampleActivity.start_date_local).toLocaleDateString()})\n`);

      const detailResponse = await client.get(`/activity/${sampleActivity.id}`);
      const detail = detailResponse.data;

      // Save full activity
      fs.writeFileSync('sample-activity-full.json', JSON.stringify(detail, null, 2));
      console.log('✅ Full activity data saved to: sample-activity-full.json\n');

      console.log('Available metrics:');
      console.log('   - Type:', detail.type);
      console.log('   - Duration:', detail.moving_time ? Math.round(detail.moving_time / 60) : 'N/A', 'min');
      console.log('   - Distance:', detail.distance ? (detail.distance / 1000).toFixed(2) : 'N/A', 'km');

      if (detail.avg_watts) console.log('   - Avg Power:', Math.round(detail.avg_watts), 'W');
      if (detail.weighted_avg_watts) console.log('   - NP:', Math.round(detail.weighted_avg_watts), 'W');
      if (detail.variability_index) console.log('   - VI:', detail.variability_index.toFixed(3));
      if (detail.avg_hr) console.log('   - Avg HR:', Math.round(detail.avg_hr), 'bpm');
      if (detail.max_hr) console.log('   - Max HR:', Math.round(detail.max_hr), 'bpm');
      if (detail.avg_cadence) console.log('   - Avg Cadence:', Math.round(detail.avg_cadence));
      if (detail.avg_run_cadence) console.log('   - Run Cadence:', Math.round(detail.avg_run_cadence), 'spm');
      if (detail.training_load) console.log('   - TSS:', Math.round(detail.training_load));
      if (detail.intensity) console.log('   - IF:', detail.intensity.toFixed(3));
      if (detail.avg_speed) console.log('   - Avg Speed:', detail.avg_speed.toFixed(2), 'm/s');

      console.log('\n   Streams available:', detail.streams_types?.join(', ') || 'None');

      // Try to get streams data if available
      if (detail.streams_types && detail.streams_types.length > 0) {
        console.log('\n📊 Attempting to fetch streams data...');
        try {
          // Note: The streams endpoint might be different, this is experimental
          const streamsUrl = `/activity/${sampleActivity.id}/streams.csv`;
          const streamsResponse = await client.get(streamsUrl);
          console.log('✅ Streams CSV fetched!');
          fs.writeFileSync('sample-activity-streams.csv', streamsResponse.data);
          console.log('   Saved to: sample-activity-streams.csv');
        } catch (err) {
          console.log('⚠️  Could not fetch streams CSV (endpoint might require different format)');
          console.log('   Error:', err.response?.status, err.response?.statusText);
        }
      }

      console.log('\n🎉 Sample data collected successfully!\n');

    } else {
      console.log('⚠️  All activities are from Strava.');
      console.log('\nTo get full FIT file data in Intervals.icu:');
      console.log('1. Upload activities directly from COROS app');
      console.log('2. Or sync COROS → Intervals.icu directly (not via Strava)');
      console.log('3. Or manually upload .FIT files to Intervals.icu\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

findNonStravaActivity();
