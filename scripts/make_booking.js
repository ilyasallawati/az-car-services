// Create a booking via the public API (same path a client's phone uses)
// Usage: node scripts/make_booking.js
const fs = require('fs');
const cfg = fs.readFileSync('public/config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL: "([^"]+)"/)[1];
const anon = cfg.match(/SUPABASE_ANON_KEY: "([^"]+)"/)[1];

const booking = {
  client_name: 'Ilyas',
  phone: '93344118',
  car_make_model: 'Nissan Patrol',
  plate_number: '99041 S',
  current_km: '257000',
  pickup_address: 'Khuwair',
  pickup_time: '9:00 PM',
  service_type: 'regular',
  service_date: '2026-08-16', // Sun 16 Aug
  notes: null
};

(async () => {
  const res = await fetch(url + '/rest/v1/bookings', {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: 'Bearer ' + anon,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(booking)
  });
  const j = await res.json();
  if (!res.ok) { console.error('FAIL', res.status, JSON.stringify(j)); process.exit(1); }
  const b = j[0];
  console.log('BOOKED ✅ ref:', b.id.slice(0, 8).toUpperCase());
  console.log(`  ${b.car_make_model} ${b.plate_number} · regular @ ${b.current_km} km`);
  console.log(`  service ${b.service_date} · pickup ${b.pickup_time} (${b.pickup_address}) · ${b.status}`);

  const r2 = await fetch(url + '/rest/v1/bookings?select=id&service_date=eq.2026-08-16&status=neq.cancelled', {
    headers: { apikey: anon, Authorization: 'Bearer ' + anon }
  });
  const rows = await r2.json();
  console.log('Tomorrow (Sun 16 Aug) occupancy:', rows.length, '/ 5');
})();
