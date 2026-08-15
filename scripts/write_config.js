// Writes real Supabase keys into public/config.js from /tmp/az_keys.json
const fs = require('fs');
const k = JSON.parse(fs.readFileSync('/tmp/az_keys.json', 'utf8'));
const content = `// ============================================================
// AZ Car Services — configuration
// ============================================================
window.AZ_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(k.url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(k.anon)},
  GARAGE_NAME: "AZ Car Services",
  GARAGE_PHONE_DISPLAY: "+968 XXXX XXXX",  // TODO: set the garage's real phone number
  MAX_CARS_PER_DAY: 5,
  PICKUP_WINDOW: "7:00 PM – 10:00 PM"
};
`;
fs.writeFileSync('public/config.js', content);
console.log('config.js updated — URL:', k.url);
