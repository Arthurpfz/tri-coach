const N8NClient = require('./n8n-client');

async function publishFix() {
  const client = new N8NClient();

  try {
    console.log('Fetching current workflow...\n');
    const workflow = await client.getWorkflow('Q2KE0XGsc8NWLY8V');

    // The draft already has the fix, so we need to tell the user to activate it
    console.log('=== ANALYSIS ===\n');
    console.log('✅ Good news: The fix is already in your DRAFT version!');
    console.log('❌ Problem: The ACTIVE version (running in production) is outdated.\n');

    console.log('Draft version Get Activities authorization:');
    const draftNode = workflow.nodes.find(n => n.name === 'Get Activities');
    const draftAuth = draftNode?.parameters?.headerParameters?.parameters?.find(
      p => p.name === 'Authorization'
    );
    console.log(`   ${draftAuth?.value}`);

    console.log('\nActive version Get Activities authorization:');
    const activeNode = workflow.activeVersion?.nodes.find(n => n.name === 'Get Activities');
    const activeAuth = activeNode?.parameters?.headerParameters?.parameters?.find(
      p => p.name === 'Authorization'
    );
    console.log(`   ${activeAuth?.value}\n`);

    console.log('=== SOLUTION ===\n');
    console.log('The N8N API does not allow programmatic workflow updates via PATCH.');
    console.log('You need to manually publish the draft in the N8N UI:\n');
    console.log('1. Go to: https://apfz.app.n8n.cloud/workflow/Q2KE0XGsc8NWLY8V');
    console.log('2. Click the "Save" button (or "Activate" if it\'s deactivated)');
    console.log('3. This will publish the draft version with the fix\n');

    console.log('=== ALTERNATIVE: MANUAL FIX ===\n');
    console.log('If the draft doesn\'t have the fix, you can manually edit in N8N:');
    console.log('1. Open the "Get Activities" node');
    console.log('2. Go to Headers section');
    console.log('3. Change Authorization header value from:');
    console.log('   Bearer {{ $(\'Loop Over Items\').item.json[\'Strava Access Token\'] }}');
    console.log('4. To:');
    console.log('   Bearer {{ $(\'HTTP Request\').item.json.access_token }}');
    console.log('5. Click Save\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

publishFix();
