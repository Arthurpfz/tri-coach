const axios = require('axios');
require('dotenv').config();

const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_BASE_URL = 'https://apfz.app.n8n.cloud/api/v1';
const WORKFLOW_ID = 'GkCUladuCe95T5fb';

const client = axios.create({
  baseURL: N8N_BASE_URL,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function testHardcoreMode() {
  console.log('🔥 TESTING HARDCORE MODE WORKFLOW\n');

  try {
    // Check workflow status
    console.log('1. Checking workflow status...');
    const workflow = await client.get(`/workflows/${WORKFLOW_ID}`);
    console.log('   ✅ Workflow found');
    console.log('   Name:', workflow.data.name);
    console.log('   Active:', workflow.data.active);
    console.log('');

    // Manual execution
    console.log('2. Triggering manual execution...');
    console.log('   ⚠️  Manual execution via API not available in N8N Cloud');
    console.log('   Instead, use the UI:');
    console.log('   1. Go to: https://apfz.app.n8n.cloud/workflow/' + WORKFLOW_ID);
    console.log('   2. Click "Test workflow" button');
    console.log('   3. Check execution results\n');

    // Check recent executions
    console.log('3. Checking recent executions...');
    const executions = await client.get(`/executions`, {
      params: {
        workflowId: WORKFLOW_ID,
        limit: 5
      }
    });

    if (executions.data.data && executions.data.data.length > 0) {
      console.log(`   Found ${executions.data.data.length} recent execution(s):\n`);
      executions.data.data.forEach((exec, i) => {
        const date = new Date(exec.startedAt).toLocaleString();
        const status = exec.finished ? '✅ Completed' : '⏳ Running';
        const mode = exec.mode || 'scheduled';
        console.log(`   ${i + 1}. ${status} - ${date} (${mode})`);
        if (exec.stoppedAt) {
          const duration = Math.round((new Date(exec.stoppedAt) - new Date(exec.startedAt)) / 1000);
          console.log(`      Duration: ${duration}s`);
        }
      });
      console.log('');
    } else {
      console.log('   No executions yet. Workflow will run at 20:10 Berlin time.\n');
    }

    // Verify Intervals.icu integration
    console.log('4. Testing Intervals.icu API...');
    const ATHLETE_ID = 'i492254';
    const API_KEY = 'INTERVALS_API_KEY_REDACTED';

    const intervalsClient = axios.create({
      baseURL: 'https://intervals.icu/api/v1',
      auth: {
        username: 'API_KEY',
        password: API_KEY
      }
    });

    const today = new Date().toISOString().split('T')[0];
    const activities = await intervalsClient.get(`/athlete/${ATHLETE_ID}/activities`, {
      params: { oldest: today, newest: today }
    });

    console.log(`   ✅ Found ${activities.data.length} activity/activities today`);

    if (activities.data.length > 0) {
      const nonStrava = activities.data.filter(a => a.source !== 'STRAVA');
      console.log(`   ${nonStrava.length} non-Strava activity/activities (will be analyzed)`);

      if (nonStrava.length > 0) {
        console.log('\n   Latest non-Strava activity:');
        const latest = nonStrava[0];
        console.log(`   - Type: ${latest.type}`);
        console.log(`   - Duration: ${Math.round(latest.moving_time / 60)}min`);
        console.log(`   - Source: ${latest.source || 'Direct upload'}`);

        // Fetch detailed metrics
        const detail = await intervalsClient.get(`/activity/${latest.id}`);
        console.log('\n   Available metrics:');
        if (detail.data.avg_watts) console.log(`   - Power: ${Math.round(detail.data.avg_watts)}W avg`);
        if (detail.data.average_heartrate) console.log(`   - HR: ${Math.round(detail.data.average_heartrate)}bpm avg`);
        if (detail.data.average_cadence) console.log(`   - Cadence: ${Math.round(detail.data.average_cadence * 2)}spm`);
        if (detail.data.icu_training_load) console.log(`   - TSS: ${Math.round(detail.data.icu_training_load)}`);
        if (detail.data.stream_types) console.log(`   - Streams: ${detail.data.stream_types.length} types available`);
      }
    }
    console.log('');

    console.log('🎉 HARDCORE MODE TEST COMPLETE\n');
    console.log('Next steps:');
    console.log('1. Activate workflow in N8N UI if not already active');
    console.log('2. Wait for tonight\'s scheduled run at 20:10 Berlin');
    console.log('3. Check Telegram for 🔥 HARDCORE MODE message\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testHardcoreMode();
