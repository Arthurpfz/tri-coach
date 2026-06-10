const N8NClient = require('./n8n-client');

async function fixWorkflow() {
  const client = new N8NClient();

  console.log('Step 1: Fetching current workflow...\n');

  try {
    // Get the current workflow
    const workflow = await client.getWorkflow('Q2KE0XGsc8NWLY8V');
    console.log('✅ Workflow fetched successfully\n');

    // Find the "Get Activities" node
    const getActivitiesNode = workflow.nodes.find(node => node.name === 'Get Activities');

    if (!getActivitiesNode) {
      console.error('❌ Could not find "Get Activities" node');
      return;
    }

    console.log('Step 2: Fixing "Get Activities" node...\n');
    console.log('Current Authorization header:');
    const currentAuth = getActivitiesNode.parameters.headerParameters.parameters.find(
      p => p.name === 'Authorization'
    );
    console.log(`   ${currentAuth.value}\n`);

    // Update the authorization header to use the refreshed token
    currentAuth.value = '=Bearer {{ $(\'HTTP Request\').item.json.access_token }}';

    console.log('New Authorization header:');
    console.log(`   ${currentAuth.value}\n`);

    console.log('Step 3: Updating workflow in N8N...\n');

    // Update the workflow
    const updateData = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
      tags: workflow.tags || []
    };

    const result = await client.updateWorkflow('Q2KE0XGsc8NWLY8V', updateData);

    console.log('✅ Workflow updated successfully!\n');
    console.log('Changes made:');
    console.log('  - Fixed "Get Activities" node to use refreshed Strava token');
    console.log('  - Changed from: Loop Over Items token (old/expired)');
    console.log('  - Changed to: HTTP Request token (freshly refreshed)\n');

    console.log('🎉 The workflow should now work correctly!');
    console.log('   Next execution will use the freshly refreshed token.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

fixWorkflow();
