# AZ Car Services — Booking PWA

Client booking app + garage admin dashboard. Clients pick a service day (max **5 cars/day**),
the driver collects the car the night before (7–10 PM) and delivers it back after the service.
Major services (50k / 100k / 150k km) take 2 days. Parts/repair approvals happen over WhatsApp.

- **Client page** — `index.html` (book + track booking)
- **Garage dashboard** — `admin.html` (staff sign-in required)
- **Data** — Supabase (free tier, PostgreSQL)
- **Host** — Replit (Node.js, always-on with paid plan)

---

## Part 1 — Supabase setup (5 minutes, one time)

1. Go to **https://supabase.com** → sign up (free) → **New project**.
   - Pick a name (e.g. `az-car-services`), a strong database password, region **Singapore** (closest to Oman).
2. Open **SQL Editor** → paste the whole contents of `supabase-schema.sql` → **Run**.
   This creates the `bookings` table, security rules, and the 5-cars-per-day enforcement trigger.
3. Create the garage staff login:
   - **Authentication → Users → Add user** → email + password (e.g. `garage@azcars.com` + a strong password).
   - This is the account used to sign in on the dashboard.
4. Get your keys:
   - **Project Settings → API** → copy **Project URL** and **anon public key**.
5. Paste both into `public/config.js`:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   ```
6. (Recommended) Enable live dashboard updates:
   - **Database → Replication** → in the table list, enable **Realtime** for `bookings`.

> The anon key is safe to expose — security is enforced by the database rules, not by hiding the key.

## Part 2 — Deploy on Replit

**Option A (recommended): import from GitHub**
1. Push this folder to a GitHub repo (or ask your assistant to do it):
   ```bash
   git init && git add -A && git commit -m "AZ Car Services PWA"
   ```
2. On Replit: **Create → Import from GitHub** → pick the repo → it auto-detects Node.js and runs `npm start`.
3. Open the Replit URL — done. The app is reachable on any phone.

**Option B: upload directly**
1. On Replit: **Create Repl → Node.js** template.
2. Upload all project files (drag & drop), then press **Run**.

## Part 3 — Test it

- Open the app on your phone → book a test service → check it appears in the dashboard.
- Sign in at `your-app-url/admin.html` with the staff account from step 3.
- Try booking a 6th car on a full day → the app blocks it (server-side trigger enforces this too).

## Project structure

```
server.js            Express server (static files)
supabase-schema.sql  Database schema — run once in Supabase SQL Editor
public/
  index.html         Client booking page
  admin.html         Garage dashboard
  config.js          ← paste your Supabase keys here
  css/style.css      Dark theme (amber accents)
  js/common.js       Shared helpers (dates, capacity, WhatsApp)
  js/booking.js      Client booking logic
  js/admin.js        Dashboard logic
  manifest.json      PWA manifest
  sw.js              Service worker (offline + installable)
  icons/             App icons
```

## How the booking rules work

- **Regular service** (5k–15k km): occupies 1 day, car back the evening after the service day.
- **Major service** (50k/100k/150k km): occupies the service day **and** the next day (2 days).
- Max 5 cars per day, enforced in the app **and** by a database trigger (no double-booking).
- **Pickup**: the night before the service day, between 7:00–10:00 PM.
- **Parts approval**: staff clicks "Approve parts" → WhatsApp opens with a pre-filled approval
  message → client replies APPROVE → staff marks the car done.
- **Payment**: cash/transfer on delivery (no online payment in v1).

## Notes / limitations

- Anyone with the link can book (public booking is the point). Spam bookings can be cancelled
  from the dashboard.
- Omani numbers (8 digits starting with 7/9) are auto-converted to international format for WhatsApp.
- WhatsApp uses free `wa.me` links — no API costs. Upgrade to WhatsApp Business API later if you want automated replies.
