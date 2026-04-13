const N8NClient = require('./n8n-client');

async function checkExecutions() {
  const client = new N8NClient();

  console.log('Fetching recent executions for Daily Checkin workflow...\n');

  try {
    // Get executions for the Daily Checkin workflow
    const executions = await client.getExecutions('Q2KE0XGsc8NWLY8V', 10);

    console.log(`Found ${executions.data?.length || 0} recent executions\n`);

    if (executions.data && executions.data.length > 0) {
      executions.data.forEach((execution, index) => {
        const status = execution.status || execution.finished ? '✅ Success' : '❌ Failed';
        const startTime = new Date(execution.startedAt).toLocaleString();
        const mode = execution.mode || 'unknown';

        console.log(`${index + 1}. Execution ${execution.id}`);
        console.log(`   Status: ${status}`);
        console.log(`   Started: ${startTime}`);
        console.log(`   Mode: ${mode}`);

        if (execution.stoppedAt) {
          const duration = new Date(execution.stoppedAt) - new Date(execution.startedAt);
          console.log(`   Duration: ${Math.round(duration / 1000)}s`);
        }

        if (execution.status === 'error' || !execution.finished) {
          console.log(`   ⚠️  ERROR DETECTED`);
        }

        console.log('');
      });
    } else {
      console.log('No executions found');
    }

  } catch (error) {
    console.error('Error fetching executions:', error.message);
  }
}

checkExecutions();
