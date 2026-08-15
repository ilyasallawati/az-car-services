// E2E test suite v2 — AZ Car Services Supabase backend
const fs = require('fs');
const K = JSON.parse(fs.readFileSync('/tmp/az_keys.json', 'utf8'));
const BASE = K.url;
const anon = K.anon;

function iso(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

// PostgREST: apikey header must be anon/service key; JWT goes in Authorization
async function rest(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}/rest/v1${path}`, {
    method,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token || anon}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

// service-role helper (bypasses RLS) — for cleanup only
async function srv(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/rest/v1${path}`, {
    method,
    headers: {
      apikey: K.serviceRole,
      Authorization: `Bearer ${K.serviceRole}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

(async () => {
  // pre-clean any leftover test rows from the previous run
  await srv('/bookings?notes=eq.E2E TEST', { method: 'DELETE' });

  const day = iso(10);
  const day2 = iso(11);
  console.log(`Test window: ${day} / ${day2}\n`);

  // A) anonymous read
  console.log('A) Public read:');
  let r = await rest(`/bookings?select=id&service_date=eq.${day}`);
  check('anon SELECT returns 200', r.status === 200, `got ${r.status}`);

  // B) fill the day to 5
  console.log('B) Fill day to 5 cars:');
  let okCount = 0;
  for (let i = 1; i <= 5; i++) {
    r = await rest('/bookings', {
      method: 'POST',
      body: {
        client_name: `Test Client ${i}`, phone: `9${10000000 + i}`,
        car_make_model: 'Toyota Corolla', plate_number: `TST${i}`,
        current_km: '15000', pickup_address: 'Test Address',
        pickup_time: '8:00 PM', service_type: 'regular',
        service_date: day, notes: 'E2E TEST'
      }
    });
    if (r.status === 201) okCount++;
  }
  check('5 regular bookings accepted', okCount === 5, `${okCount}/5`);

  // C) 6th car rejected
  console.log('C) Overbook guard:');
  r = await rest('/bookings', {
    method: 'POST',
    body: {
      client_name: 'Test Client 6', phone: '9100000006',
      car_make_model: 'Honda Civic', plate_number: 'TST6',
      pickup_address: 'Test', pickup_time: '8:00 PM',
      service_type: 'regular', service_date: day, notes: 'E2E TEST'
    }
  });
  check('6th booking rejected (garage_full)', r.status === 400 && (r.json?.message || '').includes('garage_full'), `status ${r.status} msg ${r.json?.message}`);

  // D) major blocks 2 days
  console.log('D) Major service occupies 2 days:');
  r = await rest('/bookings', {
    method: 'POST',
    body: {
      client_name: 'Major Test', phone: '9100000007',
      car_make_model: 'Nissan Patrol', plate_number: 'MAJ1',
      current_km: '100000', pickup_address: 'Test', pickup_time: '7:00 PM',
      service_type: 'major', service_km: '100k', service_date: day2, notes: 'E2E TEST'
    }
  });
  check('major booking accepted', r.status === 201, `got ${r.status}`);
  let allowed = 0;
  for (let i = 1; i <= 5; i++) {
    r = await rest('/bookings', {
      method: 'POST',
      body: {
        client_name: `Next Day ${i}`, phone: `91000001${i}`,
        car_make_model: 'Kia Sportage', plate_number: `ND${i}`,
        pickup_address: 'Test', pickup_time: '9:00 PM',
        service_type: 'regular', service_date: iso(12), notes: 'E2E TEST'
      }
    });
    if (r.status === 201) allowed++;
  }
  check('day after major: only 4 regulars fit (5-1)', allowed === 4, `${allowed} accepted`);

  // E) anon update must be a silent no-op (RLS blocks the row)
  console.log('E) RLS write protection:');
  const anyId = (await rest(`/bookings?select=id&service_date=eq.${day}&limit=1`)).json?.[0]?.id;
  const origStatus = (await rest(`/bookings?select=status&id=eq.${anyId}`)).json?.[0]?.status;
  r = await rest(`/bookings?id=eq.${anyId}`, { method: 'PATCH', body: { status: 'completed' } });
  const afterAnon = (await rest(`/bookings?select=status&id=eq.${anyId}`)).json?.[0]?.status;
  check('anon UPDATE did not change the row', afterAnon === origStatus, `was ${origStatus}, now ${afterAnon}`);

  // F) staff sign-in → update works
  console.log('F) Staff authenticated update:');
  const t = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'garage@azcars.com', password: K.staffPassword })
  });
  const tok = await t.json();
  check('staff sign-in OK', t.ok && tok.access_token, t.ok ? '' : JSON.stringify(tok).slice(0, 150));
  r = await rest(`/bookings?id=eq.${anyId}`, { method: 'PATCH', body: { status: 'in_service' }, token: tok.access_token });
  check('staff UPDATE accepted', r.status === 200, `got ${r.status}`);
  const afterStaff = (await rest(`/bookings?select=status&id=eq.${anyId}`, { token: tok.access_token })).json?.[0]?.status;
  check('status persisted as in_service', afterStaff === 'in_service', `got ${afterStaff}`);

  // G) cleanup via service role
  console.log('G) Cleanup:');
  r = await srv('/bookings?notes=eq.E2E TEST', { method: 'DELETE' });
  check('test bookings deleted', r.status === 200, `got ${r.status}`);
  r = await srv('/bookings?select=id&notes=eq.E2E TEST');
  check('no E2E rows remain', (r.json || []).length === 0, JSON.stringify(r.json));

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
