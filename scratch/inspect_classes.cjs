const https = require('https');

const url = 'https://octifhpwfmcyfvpufxjg.supabase.co/rest/v1/classes?limit=1';
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
      console.log("=== CLASSES ROW SAMPLE ===");
      console.log(JSON.stringify(rows[0], null, 2));
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      console.log("Data sample:", data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});
