// ============================================================
// AZ Car Services — garage admin dashboard (admin.html)
// ============================================================
(() => {
  const $ = (id) => document.getElementById(id);

  let sb = null;
  let bookings = [];
  let currentFilter = 'all';
  let approvalTarget = null; // booking being sent for approval

  const DAYS_AHEAD = 13;

  // ---------- auth ----------
  function showLogin() { $('loginView').classList.remove('hidden'); $('dashView').classList.add('hidden'); }
  function showDash(email) {
    $('loginView').classList.add('hidden');
    $('dashView').classList.remove('hidden');
    $('adminUser').textContent = email || '';
  }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = $('loginError');
    errBox.classList.add('hidden');
    const email = $('loginEmail').value.trim();
    const pass = $('loginPass').value;
    try {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    } catch (err) {
      errBox.textContent = err.message || 'Sign-in failed.';
      errBox.classList.remove('hidden');
    }
  });

  $('btnLogout').addEventListener('click', () => sb.auth.signOut());

  // ---------- data ----------
  async function loadBookings() {
    const today = AZ.todayISO();
    const { data, error } = await sb
      .from('bookings')
      .select('*')
      .gte('service_date', AZ.addISO(today, -1))
      .lte('service_date', AZ.addISO(today, DAYS_AHEAD))
      .order('service_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    bookings = data || [];
    render();
  }

  // ---------- render ----------
  function render() {
    renderStats();
    renderCapacity();
    renderList();
  }

  function renderStats() {
    const today = AZ.todayISO();
    const tomorrow = AZ.addISO(today, 1);
    const weekEnd = AZ.addISO(today, 6);
    const active = bookings.filter((b) =>
      b.status !== 'completed' && b.status !== 'cancelled' &&
      b.service_date >= today && b.service_date <= weekEnd);
    const needs = bookings.filter((b) => b.status === 'needs_approval');
    const pickups = active.filter((b) => b.service_date === tomorrow);
    const inService = bookings.filter((b) => b.status === 'in_service');
    $('statPickups').textContent = pickups.length;
    $('statTomorrow').textContent = inService.length;
    $('statActive').textContent = active.length;
    $('statNeeds').textContent = needs.length;
    $('statNeeds').style.color = needs.length ? 'var(--red)' : '';
  }

  function renderCapacity() {
    const today = AZ.todayISO();
    let html = '';
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      const iso = AZ.addISO(today, i);
      const occ = AZ.occupiedOn(bookings, iso);
      const free = AZ.MAX() - occ;
      const dt = AZ.parseISO(iso);
      const isToday = i === 0;
      html += `
        <div class="cap-day ${free <= 0 ? 'full' : 'ok'}">
          <div class="dow">${isToday ? 'Today' : dt.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
          <div class="n">${occ}/5</div>
          <div class="small muted">${free} free</div>
        </div>`;
    }
    $('capacityStrip').innerHTML = html;
  }

  function renderList() {
    const today = AZ.todayISO();
    const list = $('bookingsList');
    const visible = bookings.filter((b) => currentFilter === 'all' || b.status === currentFilter);
    const groups = new Map();
    visible.forEach((b) => {
      if (!groups.has(b.service_date)) groups.set(b.service_date, []);
      groups.get(b.service_date).push(b);
    });
    $('listMeta').textContent = `(${visible.length} shown)`;
    $('listEmpty').classList.toggle('hidden', visible.length > 0);

    let html = '';
    for (const [iso, items] of groups) {
      const occ = AZ.occupiedOn(bookings, iso);
      const rel = iso === today ? ' <span class="badge confirmed">Today</span>' : '';
      html += `<div class="day-group">
        <div class="day-group-head">
          <h3>${AZ.fmtDate(iso)}${rel}</h3>
          <span>${occ}/5 cars</span>
        </div>`;
      items.forEach((b) => { html += bookingCard(b); });
      html += `</div>`;
    }
    list.innerHTML = html;
  }

  function bookingCard(b) {
    const phone = AZ.escapeHtml(b.phone);
    const greeting = AZ.waLink(b.phone,
      `Hello ${b.client_name}, this is AZ Car Services. Regarding your ${b.car_make_model} (${b.plate_number}) — ${b.service_type === 'major' ? `major service ${b.service_km || ''}` : 'regular service'} booked for ${AZ.fmtDate(b.service_date)}. We will collect your car ${b.pickup_time} on ${AZ.fmtDate(AZ.addISO(b.service_date, -1))}. Reply here or call us. Thank you.`);
    const approvedMsg = AZ.waLink(b.phone,
      `Hello ${b.client_name}, AZ Car Services here. Good news — the parts for your ${b.car_make_model} (${b.plate_number}) are approved and we are continuing the service. Thank you.`);

    let actions = '';
    if (b.status === 'confirmed') {
      actions += `<button class="btn btn-sm" data-act="service" data-id="${b.id}">🔧 In service</button>`;
      actions += `<button class="btn btn-sm" data-act="approve" data-id="${b.id}">🧾 Approve parts</button>`;
      actions += `<button class="btn btn-sm btn-danger" data-act="cancel" data-id="${b.id}">✕ Cancel</button>`;
    } else if (b.status === 'in_service') {
      actions += `<button class="btn btn-sm" data-act="approve" data-id="${b.id}">🧾 Approve parts</button>`;
      actions += `<button class="btn btn-sm btn-primary" data-act="complete" data-id="${b.id}">✓ Complete</button>`;
      actions += `<button class="btn btn-sm btn-danger" data-act="cancel" data-id="${b.id}">✕ Cancel</button>`;
    } else if (b.status === 'needs_approval') {
      actions += `<button class="btn btn-sm" data-act="service" data-id="${b.id}">🔧 Parts approved</button>`;
      actions += `<button class="btn btn-sm btn-danger" data-act="cancel" data-id="${b.id}">✕ Cancel</button>`;
    }

    return `
      <div class="bk-card status-${b.status}">
        <div class="bk-top">
          <div>
            <div class="bk-name">${AZ.escapeHtml(b.client_name)}</div>
            <div class="bk-car">${AZ.escapeHtml(b.car_make_model)} · <b>${AZ.escapeHtml(b.plate_number)}</b>
              ${b.service_type === 'major' ? `<span class="badge in_service">Major ${b.service_km || ''}</span>` : `<span class="badge confirmed">Regular</span>`}
            </div>
          </div>
          ${AZ.statusBadge(b.status)}
        </div>
        <div class="bk-meta">
          <span>📞 <a href="${AZ.telLink(b.phone)}" style="color:var(--accent-2)">${phone}</a></span>
          <span>📍 ${AZ.escapeHtml(b.pickup_address)}</span>
          <span>🕖 Pickup ${AZ.escapeHtml(b.pickup_time)} on ${AZ.fmtDate(AZ.addISO(b.service_date, -1))}</span>
          ${b.current_km ? `<span>📟 ${AZ.escapeHtml(b.current_km)} km</span>` : ''}
          ${b.notes ? `<span>📝 ${AZ.escapeHtml(b.notes)}</span>` : ''}
        </div>
        ${b.parts_note && b.status === 'needs_approval' ? `<div class="alert alert-warn small">🔧 Waiting approval: ${AZ.escapeHtml(b.parts_note)}</div>` : ''}
        <div class="bk-actions">
          <a class="btn btn-sm btn-wa" href="${greeting}" target="_blank" rel="noopener">WhatsApp</a>
          ${actions}
          ${b.status === 'needs_approval' ? `<a class="btn btn-sm btn-wa" href="${approvedMsg}" target="_blank" rel="noopener">WhatsApp: parts approved</a>` : ''}
        </div>
      </div>`;
  }

  // ---------- actions ----------
  async function setStatus(id, status, extra) {
    const patch = { status, ...extra };
    const { error } = await sb.from('bookings').update(patch).eq('id', id);
    if (error) {
      $('dashError').textContent = 'Update failed: ' + (error.message || 'unknown error');
      $('dashError').classList.remove('hidden');
      console.error(error);
      return false;
    }
    $('dashError').classList.add('hidden');
    await loadBookings();
    return true;
  }

  $('bookingsList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    try {
      if (act === 'service') await setStatus(id, 'in_service');
      else if (act === 'complete') await setStatus(id, 'completed');
      else if (act === 'cancel') {
        if (confirm('Cancel this booking?')) await setStatus(id, 'cancelled');
      } else if (act === 'approve') {
        approvalTarget = bookings.find((b) => b.id === id);
        $('apPart').value = '';
        $('apCost').value = '';
        $('apError').classList.add('hidden');
        $('approvalModal').classList.add('open');
      }
    } catch (err) {
      $('dashError').textContent = 'Action failed: ' + err.message;
      $('dashError').classList.remove('hidden');
    }
  });

  // ---------- approval modal ----------
  $('apCancel').addEventListener('click', () => { $('approvalModal').classList.remove('open'); approvalTarget = null; });
  $('approvalModal').addEventListener('click', (e) => { if (e.target === $('approvalModal')) $('approvalModal').classList.remove('open'); });

  $('apSend').addEventListener('click', async () => {
    const b = approvalTarget;
    const part = $('apPart').value.trim();
    const cost = $('apCost').value.trim();
    if (!b) return;
    if (!part || !cost) {
      $('apError').textContent = 'Please enter both the part description and the estimated cost.';
      $('apError').classList.remove('hidden');
      return;
    }
    const note = `${part} — ${cost} OMR`;
    const msg = `Hello ${b.client_name}, AZ Car Services here. Your ${b.car_make_model} (${b.plate_number}) needs: ${part}. Estimated cost: ${cost} OMR. Please reply APPROVE to proceed, or call us. Thank you.`;
    const ok = await setStatus(b.id, 'needs_approval', { parts_note: note });
    if (ok) {
      window.open(AZ.waLink(b.phone, msg), '_blank');
      $('approvalModal').classList.remove('open');
      approvalTarget = null;
    }
  });

  // ---------- filters ----------
  $('statusFilter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderList();
  });

  // ---------- live updates ----------
  function subscribe() {
    const channel = sb
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' },
        () => { loadBookings().catch(() => {}); })
      .subscribe();
    return channel;
  }

  // ---------- init ----------
  async function init() {
    if (!AZ.isConfigured()) {
      $('loginView').innerHTML = '<div class="card"><div class="alert alert-warn">App is not configured. Add the Supabase keys in config.js.</div></div>';
      return;
    }
    sb = AZ.supabase();

    const { data: { session } } = await sb.auth.getSession();
    if (session) showDash(session.user.email);

    sb.auth.onAuthStateChange((event, sess) => {
      if (event === 'SIGNED_IN' && sess) showDash(sess.user.email);
      if (event === 'SIGNED_OUT') { showLogin(); bookings = []; }
    });

    if (session) {
      try { await loadBookings(); } catch (e) {
        $('dashError').textContent = 'Could not load bookings: ' + e.message;
        $('dashError').classList.remove('hidden');
      }
      subscribe();
      setInterval(() => { loadBookings().catch(() => {}); }, 60000); // fallback polling
    }
  }

  init();
})();
