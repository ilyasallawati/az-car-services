// AZ Car Services — static server for the PWA
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  setHeaders(res, filePath) {
    // Never cache the config so a changed Supabase key is picked up fast
    if (filePath.endsWith('config.js')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'AZ Car Services' }));

app.listen(PORT, () => {
  console.log(`AZ Car Services running on http://0.0.0.0:${PORT}`);
});
