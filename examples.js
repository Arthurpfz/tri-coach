const N8NClient = require('./n8n-client');

async function examples() {
  const client = new N8NClient();

  // Example 1: List all workflows
  console.log('=== Example 1: List all workflows ===');
  const workflows = await client.getWorkflows();
  console.log('Workflows:', workflows.data);
  console.log('\n');

  // Example 2: Get a specific workflow (replace with actual ID)
  // console.log('=== Example 2: Get specific workflow ===');
  // const workflow = await client.getWorkflow('your-workflow-id');
  // console.log('Workflow:', workflow);
  // console.log('\n');

  // Example 3: Create a new workflow
  // console.log('=== Example 3: Create new workflow ===');
  // const newWorkflow = await client.createWorkflow({
  //   name: 'My New Workflow',
  //   nodes: [],
  //   connections: {},
  //   active: false,
  //   settings: {},
  // });
  // console.log('Created workflow:', newWorkflow);
  // console.log('\n');

  // Example 4: Update a workflow
  // console.log('=== Example 4: Update workflow ===');
  // const updatedWorkflow = await client.updateWorkflow('your-workflow-id', {
  //   name: 'Updated Workflow Name',
  // });
  // console.log('Updated workflow:', updatedWorkflow);
  // console.log('\n');

  // Example 5: Activate/Deactivate a workflow
  // console.log('=== Example 5: Activate workflow ===');
  // await client.activateWorkflow('your-workflow-id');
  // console.log('Workflow activated');
  // console.log('\n');

  // Example 6: Execute a workflow
  // console.log('=== Example 6: Execute workflow ===');
  // const execution = await client.executeWorkflow('your-workflow-id', {
  //   // Optional input data
  // });
  // console.log('Execution result:', execution);
  // console.log('\n');

  // Example 7: Get executions
  // console.log('=== Example 7: Get recent executions ===');
  // const executions = await client.getExecutions(null, 10);
  // console.log('Recent executions:', executions);
  // console.log('\n');

  // Example 8: Delete a workflow
  // console.log('=== Example 8: Delete workflow ===');
  // await client.deleteWorkflow('your-workflow-id');
  // console.log('Workflow deleted');
}

// Run examples
examples().catch(console.error);
