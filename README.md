# N8N Workflow Manager

A Node.js client for managing N8N workflows programmatically.

## Setup

### 1. Get Your N8N API Key

To get your API key from N8N Cloud:

1. Go to your N8N instance: https://apfz.app.n8n.cloud
2. Click on your profile icon in the top right
3. Select **Settings**
4. Navigate to **API** in the left sidebar
5. Click **Create an API key**
6. Give it a name (e.g., "Workflow Manager")
7. Copy the generated API key

### 2. Configure Environment Variables

Edit the `.env` file and replace `your_api_key_here` with your actual API key:

```env
N8N_API_URL=https://apfz.app.n8n.cloud/api/v1
N8N_API_KEY=your_actual_api_key_here
```

### 3. Test Connection

Run the test script to verify your connection:

```bash
npm test
```

## Usage

### Basic Example

```javascript
const N8NClient = require('./n8n-client');

const client = new N8NClient();

// Get all workflows
const workflows = await client.getWorkflows();
console.log(workflows);
```

### Available Methods

- `getWorkflows()` - Get all workflows
- `getWorkflow(workflowId)` - Get a specific workflow
- `createWorkflow(workflowData)` - Create a new workflow
- `updateWorkflow(workflowId, workflowData)` - Update a workflow
- `deleteWorkflow(workflowId)` - Delete a workflow
- `activateWorkflow(workflowId)` - Activate a workflow
- `deactivateWorkflow(workflowId)` - Deactivate a workflow
- `executeWorkflow(workflowId, data)` - Execute a workflow
- `getExecutions(workflowId, limit)` - Get workflow executions

### Running Examples

See `examples.js` for more usage examples:

```bash
npm run examples
```

## Scripts

- `npm test` - Test connection to N8N
- `npm run examples` - Run example operations

## Security

- Never commit your `.env` file
- Keep your API key secure
- The `.gitignore` file is configured to exclude `.env`
