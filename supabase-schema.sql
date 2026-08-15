-- ============================================================
-- AZ Car Services — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1) Bookings table
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  phone text not null,
  car_make_model text not null,
  plate_number text not null,
  current_km text,
  pickup_address text not null,
  pickup_time text not null,            -- e.g. "7:00 PM"
  service_type text not null check (service_type in ('regular', 'major')),
  service_km text,                      -- e.g. "50k" for major services
  service_date date not null,           -- first service day (pickup is the night before)
  status text not null default 'confirmed'
    check (status in ('confirmed', 'in_service', 'needs_approval', 'completed', 'cancelled')),
  parts_note text,                      -- e.g. "Brake pads — 12 OMR" awaiting approval
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists bookings_service_date_idx on public.bookings (service_date);
create index if not exists bookings_phone_idx on public.bookings (phone);

-- 2) Row Level Security
alter table public.bookings enable row level security;

drop policy if exists "public read bookings" on public.bookings;
drop policy if exists "public can book" on public.bookings;
drop policy if exists "staff update bookings" on public.bookings;
drop policy if exists "staff delete bookings" on public.bookings;

-- Clients can see availability (read) and create bookings (insert)
create policy "public read bookings" on public.bookings
  for select using (true);

create policy "public can book" on public.bookings
  for insert with check (true);

-- Only signed-in garage staff can update / delete
create policy "staff update bookings" on public.bookings
  for update using (auth.role() = 'authenticated');

create policy "staff delete bookings" on public.bookings
  for delete using (auth.role() = 'authenticated');

-- 3) Hard limit: max 5 cars per service day.
--    A major service occupies BOTH service_date and the next day.
--    (Aborts the insert if the slot is already full — prevents double booking.)
create or replace function public.check_slot_available()
returns trigger
language plpgsql
security definer
as $$
declare
  occ_day1 integer;
  occ_day2 integer;
begin
  select count(*) into occ_day1
  from public.bookings b
  where b.status <> 'cancelled'
    and (
      (b.service_type = 'regular' and b.service_date = NEW.service_date)
      or (b.service_type = 'major' and (b.service_date = NEW.service_date or b.service_date = NEW.service_date - 1))
    );

  if occ_day1 >= 5 then
    raise exception 'garage_full';
  end if;

  if NEW.service_type = 'major' then
    select count(*) into occ_day2
    from public.bookings b
    where b.status <> 'cancelled'
      and (
        (b.service_type = 'regular' and b.service_date = NEW.service_date + 1)
        or (b.service_type = 'major' and (b.service_date = NEW.service_date + 1 or b.service_date = NEW.service_date))
      );

    if occ_day2 >= 5 then
      raise exception 'garage_full';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_slot_limit on public.bookings;
create trigger enforce_slot_limit
  before insert on public.bookings
  for each row execute function public.check_slot_available();

-- 4) Live updates for the admin dashboard (optional but nice)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
