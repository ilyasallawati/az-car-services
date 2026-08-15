// Supabase setup driver — schema apply + staff user + key export
const fs = require('fs');
const { execSync } = require('child_process');

const REF = 'yvrzunosippnggsibrrw';
const BASE = `https://api.supabase.com/v1/projects/${REF}`;

const token = execSync('security find-generic-password -s "Supabase CLI" -a supabase -w 2>/dev/null').toString().trim();
if (!token) { console.error('NO TOKEN'); process.exit(1); }

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  // 1) anon key
  const keys = await api('/api-keys');
  const anon = keys.find(k => k.name === 'anon').api_key;
  console.log('ANON_KEY_OK', anon.slice(0, 12) + '...' + anon.slice(-6));

  // 2) apply schema
  const sql = fs.readFileSync('supabase-schema.sql', 'utf8');
  const r = await api('/database/query', {
    method: 'POST',
    body: JSON.stringify({ query: sql })
  });
  console.log('SCHEMA_APPLIED', JSON.stringify(r).slice(0, 120));

  // 3) staff auth user via GoTrue admin API (needs service_role)
  const keys2 = await api('/api-keys');
  const srv = keys2.find(k => k.name === 'service_role').api_key;
  const pw = 'AZ-Garage-' + Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, 'x');
  const gres = await fetch(`https://${REF}.supabase.co/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${srv}`,
      apikey: srv,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'garage@azcars.com', password: pw, email_confirm: true })
  });
  const gbody = await gres.json();
  if (!gres.ok) throw new Error(`GoTrue ${gres.status}: ${JSON.stringify(gbody).slice(0, 200)}`);
  console.log('STAFF_USER_CREATED', gbody.id);

  // 4) export for config.js
  fs.writeFileSync('/tmp/az_keys.json', JSON.stringify({ url: `https://${REF}.supabase.co`, anon, serviceRole: srv, staffPassword: pw }, null, 2));
  fs.chmodSync('/tmp/az_keys.json', 0o600);
  console.log('KEYS_WRITTEN /tmp/az_keys.json');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
