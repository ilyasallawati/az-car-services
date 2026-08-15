// ============================================================
// AZ Car Services — client booking page (index.html)
// ============================================================
(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    serviceType: null,   // 'regular' | 'major'
    serviceKm: null,     // '50k' | '100k' | '150k'
    selectedDay: null,   // ISO date
    bookings: []         // all non-cancelled bookings for the window
  };

  const DAYS_SHOWN = 14;

  // ---------- init ----------
  async function init() {
    if (!AZ.isConfigured()) {
      $('configBanner').classList.remove('hidden');
      $('hero').innerHTML = '<h2>Booking is temporarily unavailable</h2><p class="muted">Please contact the garage directly to book.</p>';
      return;
    }
    registerSW();
    await loadBookings();
    bindEvents();
    renderDayChips();
  }

  async function loadBookings() {
    try {
      const { data, error } = await AZ.supabase()
        .from('bookings')
        .select('id, service_type, service_date, status')
        .gte('service_date', AZ.addISO(AZ.todayISO(), -1))
        .lte('service_date', AZ.addISO(AZ.todayISO(), 20))
        .neq('status', 'cancelled');
      if (error) throw error;
      state.bookings = data || [];
    } catch (e) {
      showError($('dayError'), 'Could not load availability. Please check your connection and refresh.');
      console.error('loadBookings:', e);
    }
  }

  // ---------- step 1: service type ----------
  function bindEvents() {
    document.querySelectorAll('.service-card').forEach((card) => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        document.querySelectorAll('.service-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        state.serviceType = type;
        state.serviceKm = null;
        state.selectedDay = null;
        $('kmRow').classList.toggle('hidden', type !== 'major');
        if (type === 'regular') {
          $('kmRow').querySelectorAll('.km-chip').forEach((c) => c.classList.remove('selected'));
        }
        renderDayChips();
        showStep('stepDay');
      });
    });

    document.querySelectorAll('.km-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.km-chip').forEach((c) => c.classList.remove('selected'));
        chip.classList.add('selected');
        state.serviceKm = chip.dataset.km;
      });
    });

    $('bookingForm').addEventListener('submit', onBook);
    $('btnTrack').addEventListener('click', toggleTrack);
    $('btnTrackGo').addEventListener('click', trackBooking);
    $('trackPhone').addEventListener('keydown', (e) => { if (e.key === 'Enter') trackBooking(); });
    $('btnDone').addEventListener('click', resetAll);
  }

  // ---------- step 2: day picker ----------
  function renderDayChips() {
    const wrap = $('days');
    if (!state.serviceType) { wrap.innerHTML = ''; return; }
    const today = AZ.todayISO();
    let html = '';
    for (let i = 1; i <= DAYS_SHOWN; i++) {
      const iso = AZ.addISO(today, i);
      const free = AZ.freeFor(state.bookings, iso, state.serviceType);
      const full = free <= 0;
      const dt = AZ.parseISO(iso);
      const dow = dt.toLocaleDateString('en-GB', { weekday: 'short' });
      const dayNum = dt.toLocaleDateString('en-GB', { day: 'numeric' });
      const mon = dt.toLocaleDateString('en-GB', { month: 'short' });
      const selected = state.selectedDay === iso ? 'selected' : '';
      html += `
        <button class="day-chip ${selected}" data-iso="${iso}" ${full ? 'disabled' : ''}>
          <div class="dow">${dow} ${mon}</div>
          <div class="date">${dayNum}</div>
          <div class="free ${full ? 'full' : ''}">${full ? 'Full' : free + ' free'}</div>
        </button>`;
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll('.day-chip:not(:disabled)').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.selectedDay = chip.dataset.iso;
        renderDayChips();
        showStep('stepDetails');
        AZ.scrollTo($('stepDetails'));
      });
    });
    if (!state.selectedDay) showStep('stepDay');
  }

  function showStep(id) {
    const order = ['stepService', 'stepDay', 'stepDetails', 'stepSuccess'];
    order.forEach((s) => $(s).classList.toggle('hidden', s !== id));
    if (id === 'stepDay') AZ.scrollTo($('stepDay'));
  }

  // ---------- step 3: submit ----------
  async function onBook(e) {
    e.preventDefault();
    $('formError').classList.add('hidden');
    const err = (m) => {
      const box = $('formError');
      box.textContent = m;
      box.classList.remove('hidden');
    };

    if (!state.serviceType) return err('Please choose a service type first.');
    if (state.serviceType === 'major' && !state.serviceKm) return err('Please choose the service mark (50k / 100k / 150k).');
    if (!state.selectedDay) return err('Please pick a service day.');

    const name = $('fName').value.trim();
    const phone = $('fPhone').value.trim();
    const car = $('fCar').value.trim();
    const plate = $('fPlate').value.trim();
    const km = $('fKm').value.trim();
    const pickupTime = $('fPickupTime').value;
    const address = $('fAddress').value.trim();
    const notes = $('fNotes').value.trim();

    if (!name || !phone || !car || !plate || !address) return err('Please fill in all required fields.');
    if (phone.replace(/\D/g, '').length < 8) return err('Please enter a valid mobile number.');

    // Re-check availability server-side guard will also run; client-side sanity check:
    if (AZ.freeFor(state.bookings, state.selectedDay, state.serviceType) <= 0) {
      return err('Sorry, that day just filled up — please pick another day.');
    }

    const payload = {
      client_name: name,
      phone,
      car_make_model: car,
      plate_number: plate,
      current_km: km || null,
      pickup_address: address,
      pickup_time: pickupTime,
      service_type: state.serviceType,
      service_km: state.serviceType === 'major' ? state.serviceKm : null,
      service_date: state.selectedDay,
      notes: notes || null
    };

    $('btnSubmit').disabled = true;
    $('spinnerBox').classList.remove('hidden');

    try {
      const { data, error } = await AZ.supabase().from('bookings').insert(payload).select().single();
      if (error) throw error;
      state.bookings.push(data); // keep capacity fresh
      showSuccess(data);
    } catch (e) {
      console.error('insert:', e);
      const msg = String(e.message || '');
      if (msg.includes('garage_full') || msg.includes('violates')) {
        err('Sorry — that day just filled up. Please go back and pick another day.');
      } else if (msg.includes('Failed to fetch') || msg.includes('Network')) {
        err('Network error — please check your connection and try again.');
      } else {
        err('Something went wrong. Please try again or call the garage.');
      }
    } finally {
      $('btnSubmit').disabled = false;
      $('spinnerBox').classList.add('hidden');
    }
  }

  function showSuccess(b) {
    $('refCode').textContent = b.id.slice(0, 8).toUpperCase();
    $('pickupWhen').textContent =
      `${b.pickup_time} on ${AZ.fmtDate(AZ.addISO(b.service_date, -1))}`;
    const delivery = b.service_type === 'major'
      ? AZ.fmtDate(AZ.addISO(b.service_date, 2))
      : AZ.fmtDate(AZ.addISO(b.service_date, 1));
    $('successSummary').innerHTML = `
      ${AZ.escapeHtml(b.client_name)} · ${AZ.escapeHtml(b.car_make_model)} (${AZ.escapeHtml(b.plate_number)})<br>
      <b>${AZ.STATUS[b.status]}</b> · ${b.service_type === 'major' ? `Major service ${b.service_km} — up to 2 days, back by ${delivery}` : `Regular service — back by ${delivery}`}`;
    showStep('stepSuccess');
    AZ.scrollTo($('stepSuccess'));
  }

  // ---------- track booking ----------
  function toggleTrack() {
    const sec = $('trackSection');
    sec.classList.toggle('hidden');
    if (!sec.classList.contains('hidden')) AZ.scrollTo(sec);
  }

  async function trackBooking() {
    const phone = $('trackPhone').value.trim();
    const box = $('trackResult');
    if (phone.replace(/\D/g, '').length < 8) { box.innerHTML = '<div class="alert alert-err">Please enter a valid mobile number.</div>'; return; }
    box.innerHTML = '<div class="center mt"><span class="spinner"></span></div>';
    try {
      const { data, error } = await AZ.supabase()
        .from('bookings')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      if (!data || data.length === 0) {
        box.innerHTML = '<div class="alert alert-info">No bookings found for this number.</div>';
        return;
      }
      box.innerHTML = '<div class="track-result mt">' + data.map((b) => `
        <div class="bk-card status-${b.status}">
          <div class="bk-top">
            <div>
              <div class="bk-name">${AZ.escapeHtml(b.car_make_model)} <span class="muted small">(${AZ.escapeHtml(b.plate_number)})</span></div>
              <div class="bk-car">${b.service_type === 'major' ? `Major service ${b.service_km || ''}` : 'Regular service'} · service on ${AZ.fmtDate(b.service_date)}</div>
            </div>
            ${AZ.statusBadge(b.status)}
          </div>
          ${b.parts_note ? `<div class="alert alert-warn small mt">🔧 Parts approval: ${AZ.escapeHtml(b.parts_note)} — reply APPROVE on WhatsApp or call us.</div>` : ''}
        </div>`).join('') + '</div>';
    } catch (e) {
      box.innerHTML = '<div class="alert alert-err">Could not load your bookings — try again.</div>';
      console.error(e);
    }
  }

  function resetAll() {
    state.serviceType = null;
    state.serviceKm = null;
    state.selectedDay = null;
    document.querySelectorAll('.service-card, .km-chip').forEach((c) => c.classList.remove('selected'));
    $('bookingForm').reset();
    $('kmRow').classList.add('hidden');
    $('trackResult').innerHTML = '';
    showStep('stepService');
    AZ.scrollTo($('stepService'));
  }

  // ---------- PWA ----------
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // helpers
  function showError(box, msg) { box.textContent = msg; box.classList.remove('hidden'); }

  init();
})();
