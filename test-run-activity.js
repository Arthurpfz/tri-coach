const axios = require('axios');
const fs = require('fs');

// Intervals.icu API credentials
const ATHLETE_ID = 'i492254';
const API_KEY = 'INTERVALS_API_KEY_REDACTED';
const BASE_URL = 'https://intervals.icu/api/v1';

// Create axios instance
const client = axios.create({
  baseURL: BASE_URL,
  auth: {
    username: 'API_KEY',
    password: API_KEY
  }
});

async function checkRunActivity() {
  console.log('🏃 Fetching Run activity with power/dynamics data...\n');

  try {
    // Get the Run activity from Jan 18
    const runId = 'i120254570';

    const detailResponse = await client.get(`/activity/${runId}`);
    const detail = detailResponse.data;

    console.log('✅ Run activity fetched!\n');
    console.log('Activity: Run - 1/18/2026');
    console.log('Duration:', Math.round(detail.moving_time / 60), 'min');
    console.log('Distance:', (detail.distance / 1000).toFixed(2), 'km');
    console.log('');

    console.log('Basic Metrics:');
    if (detail.average_speed) console.log('   Avg Speed:', detail.average_speed.toFixed(2), 'm/s', `(${(1000 / detail.average_speed / 60).toFixed(2)} min/km)`);
    if (detail.average_heartrate) console.log('   Avg HR:', Math.round(detail.average_heartrate), 'bpm');
    if (detail.max_heartrate) console.log('   Max HR:', Math.round(detail.max_heartrate), 'bpm');
    if (detail.average_cadence) console.log('   Avg Cadence:', Math.round(detail.average_cadence * 2), 'spm (steps per minute)');
    if (detail.icu_training_load) console.log('   TSS:', Math.round(detail.icu_training_load));
    console.log('');

    console.log('Available Streams:', detail.stream_types?.join(', ') || 'None');
    console.log('');

    // Save the full run activity
    fs.writeFileSync('sample-run-activity.json', JSON.stringify(detail, null, 2));
    console.log('📄 Full run data saved to: sample-run-activity.json\n');

    // Check for power and running dynamics
    console.log('Power & Running Dynamics:');
    const streams = detail.stream_types || [];
    const hasWatts = streams.includes('watts');
    const hasStance = streams.includes('stance_time');
    const hasVertical = streams.includes('vertical_oscillation');
    const hasStrideLength = streams.includes('stride_length');

    console.log('   Power (watts):', hasWatts ? '✅ Available' : '❌ Not available');
    console.log('   Stance Time:', hasStance ? '✅ Available' : '❌ Not available');
    console.log('   Vertical Oscillation:', hasVertical ? '✅ Available' : '❌ Not available');
    console.log('   Stride Length:', hasStrideLength ? '✅ Available' : '❌ Not available');

    if (detail.avg_watts) console.log('   Avg Power:', Math.round(detail.avg_watts), 'W');
    if (detail.avg_stride_length) console.log('   Avg Stride Length:', detail.avg_stride_length.toFixed(2), 'm');
    if (detail.avg_vertical_oscillation) console.log('   Avg Vertical Oscillation:', detail.avg_vertical_oscillation.toFixed(1), 'cm');
    if (detail.avg_ground_contact_time) console.log('   Avg Ground Contact:', detail.avg_ground_contact_time, 'ms');

    console.log('\n🎉 Run activity analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRunActivity();
