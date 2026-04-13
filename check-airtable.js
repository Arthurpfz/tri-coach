const axios = require('axios');
require('dotenv').config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || 'YOUR_TOKEN_HERE';
const BASE_ID = 'appw0Xd3T54okfaXa';
const TABLE_ID = 'tblK8jxVIxuFi9H8Z';

const client = axios.create({
  baseURL: `https://api.airtable.com/v0/${BASE_ID}`,
  headers: {
    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function checkFields() {
  console.log('Checking Airtable Users table...\n');

  try {
    const response = await client.get(`/${TABLE_ID}`);
    const users = response.data.records;

    console.log(`Found ${users.length} user(s):\n`);

    users.forEach((user, i) => {
      console.log(`${i + 1}. ${user.fields.Name || 'Unnamed'}`);
      console.log('   Record ID:', user.id);
      console.log('   Fields:');
      console.log('   - Intervals.icu Athlete ID:', user.fields['Intervals.icu Athlete ID'] || '❌ MISSING');
      console.log('   - Intervals.icu API Key:', user.fields['Intervals.icu API Key'] ? '✅ Present' : '❌ MISSING');
      console.log('   - Strava tokens:', user.fields['Strava Access Token'] ? '✅ Present' : '❌ MISSING');
      console.log('');
    });

    // Check if fields exist
    const arthur = users.find(u => u.fields.Name === 'Arthur Pfalzgraf');
    if (arthur) {
      if (!arthur.fields['Intervals.icu Athlete ID']) {
        console.log('⚠️  PROBLEM: Intervals.icu Athlete ID field is missing!');
        console.log('   Adding field to Airtable...\n');

        // Update the record
        await client.patch(`/${TABLE_ID}`, {
          records: [{
            id: arthur.id,
            fields: {
              'Intervals.icu Athlete ID': 'i492254',
              'Intervals.icu API Key': 'INTERVALS_API_KEY_REDACTED'
            }
          }]
        });

        console.log('✅ Added Intervals.icu credentials to Airtable!');
        console.log('   Athlete ID: i492254');
        console.log('   API Key: INTERVALS_API_KEY_REDACTED\n');
      } else {
        console.log('✅ Intervals.icu fields already present!\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkFields();
