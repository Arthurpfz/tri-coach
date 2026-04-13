const N8NClient = require('./n8n-client');
const fs = require('fs');

async function debugExecution() {
  const client = new N8NClient();

  console.log('Fetching full execution data...\n');

  try {
    // Get the most recent execution
    const response = await client.client.get('/executions/146');
    const execution = response.data;

    // Save full execution to file for analysis
    fs.writeFileSync('execution-146-debug.json', JSON.stringify(execution, null, 2));
    console.log('✅ Full execution data saved to execution-146-debug.json\n');

    console.log('=== QUICK SUMMARY ===\n');
    console.log('Status:', execution.status);
    console.log('Finished:', execution.finished);
    console.log('Started:', new Date(execution.startedAt).toLocaleString());
    console.log('Stopped:', execution.stoppedAt ? new Date(execution.stoppedAt).toLocaleString() : 'N/A');

    // Try to find error
    if (execution.data) {
      if (execution.data.resultData && execution.data.resultData.error) {
        console.log('\n🚨 WORKFLOW ERROR FOUND:');
        console.log('Message:', execution.data.resultData.error.message);
        console.log('Node:', execution.data.resultData.error.node?.name);
        console.log('\nFull Error:');
        console.log(JSON.stringify(execution.data.resultData.error, null, 2));
      }

      // Check lastNodeExecuted
      if (execution.data.resultData && execution.data.resultData.lastNodeExecuted) {
        console.log('\n📍 Last Node Executed:', execution.data.resultData.lastNodeExecuted);
      }

      // Check runData
      if (execution.data.resultData && execution.data.resultData.runData) {
        console.log('\n📊 Nodes Executed:');
        Object.keys(execution.data.resultData.runData).forEach(nodeName => {
          console.log(`   - ${nodeName}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugExecution();
