const N8NClient = require('./n8n-client');
const fs = require('fs');
const client = new N8NClient();
(async () => {
  const ids = {
    intervals: 'hrSGUqoAwkWQ4gKl',
    strava: 'Q2KE0XGsc8NWLY8V',
    planner: 'lUcAtn2oxCPkNkJ1'
  };
  for (const [k,v] of Object.entries(ids)) {
    const wf = await client.getWorkflow(v);
    fs.writeFileSync(`/tmp/wf-${k}.json`, JSON.stringify(wf, null, 2));
    console.log(k, 'saved');
  }
})();
