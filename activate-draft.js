const N8NClient = require('./n8n-client');

async function activateDraft() {
  const client = new N8NClient();

  try {
    console.log('Step 1: Deactivating current workflow...\n');
    await client.deactivateWorkflow('Q2KE0XGsc8NWLY8V');
    console.log('✅ Workflow deactivated\n');

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 2: Reactivating workflow (this should use the latest draft)...\n');
    await client.activateWorkflow('Q2KE0XGsc8NWLY8V');
    console.log('✅ Workflow reactivated with latest version!\n');

    // Verify the fix
    console.log('Step 3: Verifying the fix...\n');
    const workflow = await client.getWorkflow('Q2KE0XGsc8NWLY8V');

    if (workflow.versionId === workflow.activeVersionId) {
      console.log('✅ SUCCESS! Active version now matches draft\n');

      const activeNode = workflow.activeVersion.nodes.find(n => n.name === 'Get Activities');
      if (activeNode) {
        const authHeader = activeNode.parameters.headerParameters?.parameters?.find(
          p => p.name === 'Authorization'
        );
        console.log('Active version authorization:');
        console.log(`   ${authHeader?.value}\n`);

        if (authHeader?.value.includes('HTTP Request')) {
          console.log('🎉 FIX CONFIRMED!');
          console.log('The workflow will now use the refreshed Strava token.\n');
        }
      }
    } else {
      console.log('⚠️  Versions still differ. May need manual activation in N8N UI.\n');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Details:', error.response.data);
    }
  }
}

activateDraft();
