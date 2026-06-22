const https = require('https');

const url = 'https://octifhpwfmcyfvpufxjg.supabase.co/rest/v1/students?limit=100';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdGlmaHB3Zm1jeWZ2cHVmeGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzcxNjAsImV4cCI6MjA5NjUxMzE2MH0._B91CI4B8pyppG5151TN4p3ulRavetLotReDopq29T8';

const req = https.get(url, {
  headers: {
    'apikey': apikey,
    'Authorization': `Bearer ${apikey}`
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const rows = JSON.parse(data);
      if (!Array.isArray(rows)) {
        console.error("Response is not an array:", rows);
        return;
      }
      console.log(`Fetched ${rows.length} rows.`);
      if (rows.length === 0) {
        console.log("No data found in students table.");
        return;
      }
      
      const columns = {};
      rows.forEach(row => {
        Object.keys(row).forEach(key => {
          if (!columns[key]) {
            columns[key] = { types: new Set(), samples: [] };
          }
          const val = row[key];
          const typeStr = val === null ? 'null' : typeof val;
          columns[key].types.add(typeStr);
          if (val !== null && columns[key].samples.length < 3) {
            columns[key].samples.push(val);
          }
        });
      });

      console.log("=== STUDENTS TABLE SCHEMA ANALYSIS ===");
      Object.keys(columns).forEach(col => {
        console.log(`Column: ${col}`);
        console.log(`  Types: ${Array.from(columns[col].types).join(', ')}`);
        console.log(`  Samples:`, columns[col].samples);
      });
      
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      console.log("Data sample:", data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});
