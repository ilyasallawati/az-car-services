// ============================================================
// AZ Car Services — shared helpers
// ============================================================
const AZ = (() => {
  const MAX = () => (window.AZ_CONFIG ? AZ_CONFIG.MAX_CARS_PER_DAY : 5);

  function isConfigured() {
    return window.AZ_CONFIG &&
      AZ_CONFIG.SUPABASE_URL && AZ_CONFIG.SUPABASE_URL.startsWith('http') &&
      AZ_CONFIG.SUPABASE_ANON_KEY && AZ_CONFIG.SUPABASE_ANON_KEY.startsWith('eyJ');
  }

  function supabase() {
    return window.supabase.createClient(AZ_CONFIG.SUPABASE_URL, AZ_CONFIG.SUPABASE_ANON_KEY);
  }

  // ---- dates (local timezone safe) ----
  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function addISO(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return toISO(dt);
  }
  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtDate(iso) {
    return parseISO(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function todayISO() { return toISO(new Date()); }

  // ---- capacity ----
  // Count how many non-cancelled bookings occupy a given service day:
  // regular blocks its service_date, major blocks service_date AND the next day.
  function occupiedOn(bookings, iso) {
    let n = 0;
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      if (b.service_type === 'regular' && b.service_date === iso) n++;
      else if (b.service_type === 'major' && (b.service_date === iso || b.service_date === addISO(iso, -1))) n++;
    }
    return n;
  }
  // Free slots for a service type on a day (major needs BOTH days free)
  function freeFor(bookings, iso, serviceType) {
    const free = MAX() - occupiedOn(bookings, iso);
    if (serviceType !== 'major') return free;
    return Math.min(free, MAX() - occupiedOn(bookings, addISO(iso, 1)));
  }

  // ---- WhatsApp ----
  function waPhone(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (d.length === 8 && /^[79]/.test(d)) return '968' + d;          // Omani mobile 9XXXXXXXX
    if (d.length === 9 && d.startsWith('0')) return '968' + d.slice(1);
    if (d.length === 12 && d.startsWith('968')) return d;
    if (d.length === 13 && d.startsWith('00968')) return d.slice(2);
    return d;
  }
  function waLink(phone, text) {
    return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;
  }
  function telLink(phone) { return `tel:+${waPhone(phone)}`; }

  // ---- misc ----
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const STATUS = {
    confirmed: 'Confirmed',
    in_service: 'In service',
    needs_approval: 'Needs approval',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  function statusBadge(status) {
    return `<span class="badge ${status}">${STATUS[status] || status}</span>`;
  }
  function scrollTo(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return {
    MAX, isConfigured, supabase,
    toISO, addISO, parseISO, fmtDate, todayISO,
    occupiedOn, freeFor,
    waPhone, waLink, telLink,
    escapeHtml, STATUS, statusBadge, scrollTo
  };
})();
