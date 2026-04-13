const N8NClient = require('./n8n-client');

async function testWorkflow() {
  const client = new N8NClient();

  console.log('🧪 Testing the fixed workflow...\n');

  try {
    console.log('Step 1: Executing workflow manually...\n');
    const execution = await client.executeWorkflow('Q2KE0XGsc8NWLY8V');

    console.log('✅ Workflow execution started');
    console.log('Execution ID:', execution.data?.executionId || execution.data?.id);
    console.log('\nWaiting for execution to complete...\n');

    // Wait a few seconds for execution to complete
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get the execution result
    const executionId = execution.data?.executionId || execution.data?.id;
    if (executionId) {
      const result = await client.client.get(`/executions/${executionId}`);

      console.log('=== EXECUTION RESULT ===\n');
      console.log('Status:', result.data.status);
      console.log('Finished:', result.data.finished);
      console.log('Started:', new Date(result.data.startedAt).toLocaleString());
      console.log('Stopped:', result.data.stoppedAt ? new Date(result.data.stoppedAt).toLocaleString() : 'Still running');

      if (result.data.status === 'success' || result.data.finished) {
        console.log('\n🎉 SUCCESS! The workflow executed without errors!');
        console.log('The Strava token authorization issue is fixed.\n');
      } else if (result.data.status === 'error') {
        console.log('\n❌ Execution failed. Checking for errors...');

        if (result.data.data?.resultData?.error) {
          console.log('Error:', result.data.data.resultData.error.message);
          console.log('Node:', result.data.data.resultData.error.node?.name);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Details:', error.response.data);
    }
  }
}

testWorkflow();
