const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const N8N_API_KEY = process.env.N8N_API_KEY;
const N8N_BASE_URL = 'https://apfz.app.n8n.cloud/api/v1';

const client = axios.create({
  baseURL: N8N_BASE_URL,
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function fixWorkflow() {
  console.log('Creating properly fixed workflow...\n');

  try {
    // Delete both broken ones
    try {
      await client.delete('/workflows/1IFMn9sjPXwX7APq');
      console.log('✅ Deleted old workflow');
    } catch(e) {}
    
    try {
      await client.delete('/workflows/oeJVTcVwbpHZTU3l');
      console.log('✅ Deleted broken workflow');
    } catch(e) {}

    // Load and fix the workflow
    const workflow = JSON.parse(fs.readFileSync('intervals-icu-workflow.json', 'utf8'));
    
    // Fix 1: Update Get Activities URL to remove spaces and add trim()
    const getActivities = workflow.nodes.find(n => n.name === 'Get Activities');
    if (getActivities) {
      getActivities.parameters.url = "https://intervals.icu/api/v1/athlete/{{ $('Loop Over Users').item.json['Intervals.icu Athlete ID'].trim() }}/activities";
    }
    
    // Fix 2: Update Check Activities to enable type conversion
    const checkActivities = workflow.nodes.find(n => n.name === 'Check Activities Exist');
    if (checkActivities) {
      checkActivities.parameters.conditions.options.typeValidation = 'loose';
    }
    
    console.log('\n✅ Applied all fixes:');
    console.log('   1. URL spaces removed + .trim() added');
    console.log('   2. Type conversion enabled in Check Activities');
    console.log('   3. Strava filter already removed');
    console.log('');

    const response = await client.post('/workflows', workflow);
    
    console.log('✅ Created fixed workflow!');
    console.log('   ID:', response.data.id);
    console.log('   Name:', response.data.name);
    console.log('\n   Open and activate: https://apfz.app.n8n.cloud/workflow/' + response.data.id);
    console.log('');
    
    require('child_process').exec(`open "https://apfz.app.n8n.cloud/workflow/${response.data.id}"`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

fixWorkflow();
