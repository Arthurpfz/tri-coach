const N8NClient = require('./n8n-client');
const fs = require('fs');

async function analyzeWorkflows() {
  const client = new N8NClient();

  console.log('Fetching workflow details...\n');

  try {
    // Get both workflows
    const workflow1 = await client.getWorkflow('Q2KE0XGsc8NWLY8V');
    const workflow2 = await client.getWorkflow('lUcAtn2oxCPkNkJ1');

    // Save to JSON files for detailed analysis
    fs.writeFileSync('workflow-daily-checkin.json', JSON.stringify(workflow1, null, 2));
    fs.writeFileSync('workflow-sunday-planner.json', JSON.stringify(workflow2, null, 2));

    console.log('✅ Workflows saved to JSON files for analysis\n');
    console.log('Files created:');
    console.log('  - workflow-daily-checkin.json');
    console.log('  - workflow-sunday-planner.json\n');

    // Print basic info
    console.log('=== WORKFLOW 1: Coach Tri - Daily Checkin ===');
    console.log(`ID: ${workflow1.data.id}`);
    console.log(`Active: ${workflow1.data.active}`);
    console.log(`Nodes: ${workflow1.data.nodes?.length || 0}`);
    console.log(`Created: ${workflow1.data.createdAt}`);
    console.log(`Updated: ${workflow1.data.updatedAt}\n`);

    console.log('=== WORKFLOW 2: Coach Tri - Sunday Planner ===');
    console.log(`ID: ${workflow2.data.id}`);
    console.log(`Active: ${workflow2.data.active}`);
    console.log(`Nodes: ${workflow2.data.nodes?.length || 0}`);
    console.log(`Created: ${workflow2.data.createdAt}`);
    console.log(`Updated: ${workflow2.data.updatedAt}\n`);

  } catch (error) {
    console.error('Error fetching workflows:', error.message);
  }
}

analyzeWorkflows();
