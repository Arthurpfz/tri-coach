require('dotenv').config();
const axios = require('axios');

class N8NClient {
  constructor() {
    this.baseUrl = process.env.N8N_API_URL;
    this.apiKey = process.env.N8N_API_KEY;

    if (!this.baseUrl || !this.apiKey) {
      throw new Error('N8N_API_URL and N8N_API_KEY must be set in .env file');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-N8N-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // Get all workflows
  async getWorkflows() {
    try {
      const response = await this.client.get('/workflows');
      return response.data;
    } catch (error) {
      this.handleError('Failed to get workflows', error);
    }
  }

  // Get a specific workflow by ID
  async getWorkflow(workflowId) {
    try {
      const response = await this.client.get(`/workflows/${workflowId}`);
      return response.data;
    } catch (error) {
      this.handleError(`Failed to get workflow ${workflowId}`, error);
    }
  }

  // Create a new workflow
  async createWorkflow(workflowData) {
    try {
      const response = await this.client.post('/workflows', workflowData);
      return response.data;
    } catch (error) {
      this.handleError('Failed to create workflow', error);
    }
  }

  // Update an existing workflow
  async updateWorkflow(workflowId, workflowData) {
    try {
      const response = await this.client.patch(`/workflows/${workflowId}`, workflowData);
      return response.data;
    } catch (error) {
      this.handleError(`Failed to update workflow ${workflowId}`, error);
    }
  }

  // Delete a workflow
  async deleteWorkflow(workflowId) {
    try {
      const response = await this.client.delete(`/workflows/${workflowId}`);
      return response.data;
    } catch (error) {
      this.handleError(`Failed to delete workflow ${workflowId}`, error);
    }
  }

  // Activate a workflow
  async activateWorkflow(workflowId) {
    try {
      const workflow = await this.getWorkflow(workflowId);
      const response = await this.client.patch(`/workflows/${workflowId}`, {
        ...workflow,
        active: true,
      });
      return response.data;
    } catch (error) {
      this.handleError(`Failed to activate workflow ${workflowId}`, error);
    }
  }

  // Deactivate a workflow
  async deactivateWorkflow(workflowId) {
    try {
      const workflow = await this.getWorkflow(workflowId);
      const response = await this.client.patch(`/workflows/${workflowId}`, {
        ...workflow,
        active: false,
      });
      return response.data;
    } catch (error) {
      this.handleError(`Failed to deactivate workflow ${workflowId}`, error);
    }
  }

  // Execute a workflow
  async executeWorkflow(workflowId, data = {}) {
    try {
      const response = await this.client.post(`/workflows/${workflowId}/execute`, data);
      return response.data;
    } catch (error) {
      this.handleError(`Failed to execute workflow ${workflowId}`, error);
    }
  }

  // Get executions for a workflow
  async getExecutions(workflowId = null, limit = 20) {
    try {
      const params = { limit };
      if (workflowId) {
        params.workflowId = workflowId;
      }
      const response = await this.client.get('/executions', { params });
      return response.data;
    } catch (error) {
      this.handleError('Failed to get executions', error);
    }
  }

  // Error handler
  handleError(message, error) {
    console.error(message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

module.exports = N8NClient;
