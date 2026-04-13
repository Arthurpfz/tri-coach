const N8NClient = require('./n8n-client');

async function testConnection() {
  console.log('Testing N8N connection...\n');

  try {
    const client = new N8NClient();

    // Test 1: Get all workflows
    console.log('📋 Fetching all workflows...');
    const workflows = await client.getWorkflows();
    console.log(`✅ Found ${workflows.data?.length || 0} workflow(s)\n`);

    if (workflows.data && workflows.data.length > 0) {
      console.log('Workflows:');
      workflows.data.forEach((workflow, index) => {
        console.log(`  ${index + 1}. ${workflow.name} (ID: ${workflow.id}) - ${workflow.active ? '🟢 Active' : '🔴 Inactive'}`);
      });
    }

    console.log('\n✅ Connection successful!');
    return true;
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Please check:');
    console.error('  1. Your API key is correct in the .env file');
    console.error('  2. Your N8N instance is accessible');
    console.error('  3. The API URL is correct\n');
    return false;
  }
}

// Run the test
testConnection();
