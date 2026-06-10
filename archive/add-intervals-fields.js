const axios = require('axios');
require('dotenv').config();

const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('Instructions to add Intervals.icu fields to Airtable:\n');
console.log('1. Go to: https://airtable.com/appw0Xd3T54okfaXa/tblK8jxVIxuFi9H8Z');
console.log('2. Click the "+" button to add new fields');
console.log('3. Add these fields to the Users table:\n');
console.log('   Field 1:');
console.log('   - Name: Intervals.icu Athlete ID');
console.log('   - Type: Single line text');
console.log('   - Value for Arthur Pfalzgraf: i492254\n');
console.log('   Field 2:');
console.log('   - Name: Intervals.icu API Key');
console.log('   - Type: Single line text');
console.log('   - Value for Arthur Pfalzgraf: INTERVALS_API_KEY_REDACTED\n');
console.log('4. Save changes');
console.log('5. Re-run the workflow\n');

// Open Airtable in browser
require('child_process').exec('open "https://airtable.com/appw0Xd3T54okfaXa/tblK8jxVIxuFi9H8Z"');
