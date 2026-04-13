const N8NClient = require('./n8n-client');

async function getExecutionDetail() {
  const client = new N8NClient();

  console.log('Fetching detailed execution data...\n');

  try {
    // Get the most recent execution (146)
    const response = await client.client.get('/executions/146');
    const execution = response.data;

    console.log('=== EXECUTION DETAILS ===\n');
    console.log('ID:', execution.id);
    console.log('Status:', execution.status);
    console.log('Finished:', execution.finished);
    console.log('Mode:', execution.mode);
    console.log('Started:', new Date(execution.startedAt).toLocaleString());
    console.log('Stopped:', execution.stoppedAt ? new Date(execution.stoppedAt).toLocaleString() : 'N/A');
    console.log('\n=== NODE EXECUTION STATUS ===\n');

    // Check each node's execution
    if (execution.data && execution.data.resultData) {
      const runData = execution.data.resultData.runData;

      if (runData) {
        Object.keys(runData).forEach(nodeName => {
          const nodeData = runData[nodeName];
          const lastRun = nodeData[nodeData.length - 1];

          console.log(`📍 ${nodeName}`);
          console.log(`   Runs: ${nodeData.length}`);

          if (lastRun.error) {
            console.log(`   ❌ ERROR: ${lastRun.error.message}`);
            if (lastRun.error.description) {
              console.log(`   Description: ${lastRun.error.description}`);
            }
          } else if (lastRun.data) {
            const outputCount = lastRun.data.main?.[0]?.length || 0;
            console.log(`   ✅ Success - ${outputCount} output(s)`);
          }
          console.log('');
        });
      }

      // Check for errors
      if (execution.data.resultData.error) {
        console.log('\n🚨 WORKFLOW ERROR:');
        console.log(JSON.stringify(execution.data.resultData.error, null, 2));
      }
    }

  } catch (error) {
    console.error('Error fetching execution detail:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

getExecutionDetail();
