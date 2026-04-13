const N8NClient = require('./n8n-client');

async function checkVersions() {
  const client = new N8NClient();

  try {
    const workflow = await client.getWorkflow('Q2KE0XGsc8NWLY8V');

    console.log('=== WORKFLOW VERSION INFO ===\n');
    console.log('Version ID:', workflow.versionId);
    console.log('Active Version ID:', workflow.activeVersionId);
    console.log('Version Counter:', workflow.versionCounter);
    console.log('\nVersions match?', workflow.versionId === workflow.activeVersionId ? '✅ YES' : '❌ NO');

    if (workflow.versionId !== workflow.activeVersionId) {
      console.log('\n⚠️  WARNING: Draft version differs from active version!');
      console.log('The workflow running in production uses the ACTIVE version.');
      console.log('Your draft changes are not live yet.\n');
    }

    // Check the Get Activities node in current draft
    console.log('\n=== CURRENT DRAFT - Get Activities Node ===\n');
    const draftNode = workflow.nodes.find(n => n.name === 'Get Activities');
    if (draftNode) {
      const authHeader = draftNode.parameters.headerParameters?.parameters?.find(
        p => p.name === 'Authorization'
      );
      console.log('Authorization:', authHeader?.value);
    }

    // Check the active version
    if (workflow.activeVersion) {
      console.log('\n=== ACTIVE VERSION - Get Activities Node ===\n');
      const activeNode = workflow.activeVersion.nodes.find(n => n.name === 'Get Activities');
      if (activeNode) {
        const authHeader = activeNode.parameters.headerParameters?.parameters?.find(
          p => p.name === 'Authorization'
        );
        console.log('Authorization:', authHeader?.value);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkVersions();
