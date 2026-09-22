(function () {
  'use strict';

  var E = window.ApniPolicyEngine;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SCREENS = [
    { slug: '01-arrive', title: 'Arrive', phase: 'Get set up' },
    { slug: '02-register', title: 'Register', phase: 'Get set up' },
    { slug: '03-verify', title: 'Verify', phase: 'Get set up' },
    { slug: '04-consent', title: 'Consent', phase: 'Get set up' },
    { slug: '05-patient', title: 'Who you are admitting', phase: 'Get set up' },
    { slug: '06-policy', title: 'Add the policy', phase: 'Add your policy' },
    { slug: '07-multi-policy', title: 'Multiple policies, one estimate', phase: 'Add your policy' },
    { slug: '08-reading', title: 'Reading it', phase: 'Add your policy' },
    { slug: '09-confirm', title: 'Confirm what we read', phase: 'Add your policy' },
    { slug: '10-plain-terms', title: 'Your policy, in plain terms', phase: 'Add your policy' },
    { slug: '11-lineage', title: 'Where this number comes from', phase: 'Add your policy' },
    { slug: '12-hospital', title: 'Choose the hospital', phase: 'Check an admission' },
    { slug: '13-admission', title: 'Start an admission', phase: 'Check an admission' },
    { slug: '14-verdict', title: 'The verdict', phase: 'Check an admission' },
    { slug: '15-next-steps', title: 'What to do now', phase: 'Check an admission' },
    { slug: '16-journey', title: 'The journey', phase: 'Through the stay' },
    { slug: '17-settlement', title: 'Settlement', phase: 'Through the stay' },
    { slug: '18-tpa-desk', title: 'Hospital / TPA desk view', phase: 'Through the stay' }
  ];

  // Screens the code has to recognise by name. Indices shift whenever a screen is
  // inserted; slugs do not.
  function at(slug) { return currentIndex === indexOf(slug); }
  function indexOf(slug) {
    for (var i = 0; i < SCREENS.length; i++) {
      if (SCREENS[i].slug === slug) { return i; }
    }
    return 0;
  }

  var HOSPITALS = {
    'sample-general': { name: 'Sample General Hospital', city: 'Pune', rate: 8000 },
    'specimen-multi': { name: 'Specimen Multispeciality', city: 'Pune', rate: 5000 },
    'placeholder-inst': { name: 'Placeholder Heart Institute', city: 'Pune', rate: 12000 },
    'example-city': { name: 'Example City Hospital', city: 'Nashik', rate: 6500 }
  };

  var SAMPLES = {
    A: { sumInsured: 500000, roomCapPct: 1 },
    B: { sumInsured: 1000000, roomCapPct: 2 },
    C: { sumInsured: 300000, roomCapPct: 0 }
  };

  var WORKED_CASE = { roomRatePerDay: 8000, days: 5 };

  // Screen 07 — a personal super-top-up layered over the employer policy: it
  // pays the employer settlement's residual shortfall above this deductible,
  // capped at its own sum insured. Figures flow through E.combinePolicies().
  var TOPUP = { sumInsured: 500000, deductible: 50000 };

  function seedState() {
    return {
      mobile: '',
      consents: { read: false, check: false, keep: false },
      relationship: 'Parent',
      patientName: '',
      patientAge: '',
      abhaId: '',
      sample: 'A',
      topUpOn: false,
      fileName: null,
      readingDone: false,
      resendStarted: false,
      policy: {
        sumInsured: 500000,
        roomCapPct: 1,
        icuCapLabel: '2% per day',
        copay: 'None',
        initialWaiting: '30 days',
        pedWaiting: '36 months',
        roomCategory: 'Any single private room'
      },
      admission: {
        hospitalKey: 'sample-general',
        hospital: 'Sample General Hospital',
        city: 'Pune',
        procedure: 'Cardiac',
        roomCategory: 'Single private',
        roomRatePerDay: 8000,
        days: 5,
        associatedExpenses: 150000,
        pharmacy: 40000,
        implants: 0,
        diagnostics: 0,
        icu: 60000
      },
      protectedOn: true,
      snapshot: null
    };
  }

  var st = seedState();
  var tiles = [];
  var currentIndex = 0;
  var extractTimer = null;

  function $(id) { return document.getElementById(id); }
  function fmt(v) { return E.formatINR(v); }
  function pct(ratio) { return E.formatPct(ratio); }

  function computeResult(overrides) {
    var o = overrides || {};
    return E.computeCoverage({
      sumInsured: 'sumInsured' in o ? o.sumInsured : st.policy.sumInsured,
      roomCapPct: 'roomCapPct' in o ? o.roomCapPct : st.policy.roomCapPct,
      roomRatePerDay: 'roomRatePerDay' in o ? o.roomRatePerDay : st.admission.roomRatePerDay,
      days: 'days' in o ? o.days : st.admission.days,
      associatedExpenses: st.admission.associatedExpenses,
      pharmacy: st.admission.pharmacy,
      implants: st.admission.implants,
      diagnostics: st.admission.diagnostics,
      icu: st.admission.icu,
      protectedHeadsApplied: 'protectedOn' in o ? o.protectedOn : st.protectedOn
    });
  }

  function captureSnapshot() {
    st.snapshot = {
      shortfall: computeResult().shortfall
    };
  }

  function roomCapLabel(capPct) {
    if (!capPct || capPct <= 0) { return 'No room rent cap'; }
    var v = Math.round(capPct * 100) / 100;
    return (Number.isInteger(v) ? v : String(v)) + '% of sum insured per day';
  }

  function paintDerived() {
    var cap = st.policy.roomCapPct;
    var fig = $('derived-fig');
    var capEl = $('derived-cap');
    var note = $('derived-note');
    if (!capEl || !fig) { return; }
    var wording = $('wording');
    if (cap > 0) {
      var daily = st.policy.sumInsured * (cap / 100);
      fig.textContent = fmt(daily);
      capEl.textContent = 'eligible room rent, per day';
      note.textContent = 'derived — ' + (Math.round(cap * 100) / 100) + '% of ' + fmt(st.policy.sumInsured);
      if (wording) {
        wording.textContent =
          'Section III.1 \u2014 Room Rent: eligible room charges shall not exceed ' +
          (Math.round(cap * 100) / 100) + ' percent (' + (Math.round(cap * 100) / 100) + '%) of the Sum Insured per day. ' +
          'Expenses associated with room rent exceeding this limit shall be payable in the same proportion.\n' +
          'Section III.4 \u2014 the proportionate deduction shall not apply to pharmacy, implants and devices, diagnostics, or intensive care charges.\n' +
          'Schedule \u2014 Sum Insured: INR ' + fmt(st.policy.sumInsured).slice(1) + '. Co-pay: nil. Initial waiting period: 30 days. Pre-existing diseases: 36 months.';
      }
    } else {
      fig.textContent = 'No daily limit';
      capEl.textContent = 'this policy has no room-rent clause';
      note.textContent = 'derived — the engine found no cap to apply';
      if (wording) {
        wording.textContent =
          'Section III.1 \u2014 Room Rent: no ceiling is placed on eligible room charges under this policy, and no proportionate deduction arises from room rent.\n' +
          'Section III.4 \u2014 not applicable; there is no proportionate deduction to carve out from.\n' +
          'Schedule \u2014 Sum Insured: INR ' + fmt(st.policy.sumInsured).slice(1) + '. Co-pay: nil. Initial waiting period: 30 days. Pre-existing diseases: 36 months.';
      }
    }
  }

  var CONFIRM_FIELDS = ['sumInsured', 'roomCapPct', 'icuCapPct', 'copay', 'initialWaiting', 'pedWaiting', 'roomCategory'];

  function confirmValue(field) {
    switch (field) {
      case 'sumInsured': return fmt(st.policy.sumInsured);
      case 'roomCapPct': return roomCapLabel(st.policy.roomCapPct);
      case 'icuCapPct': return st.policy.icuCapLabel;
      case 'copay': return st.policy.copay;
      case 'initialWaiting': return st.policy.initialWaiting;
      case 'pedWaiting': return st.policy.pedWaiting;
      case 'roomCategory': return st.policy.roomCategory;
    }
    return '';
  }

  function commitConfirmed(field, raw) {
    var v = raw.trim();
    if (field === 'sumInsured') {
      var n = parseInt(v.replace(/[^\d]/g, ''), 10);
      if (n >= 10000) {
        st.policy.sumInsured = n;
      }
    } else if (field === 'roomCapPct') {
      if (/^(no|none|nil)/i.test(v)) {
        st.policy.roomCapPct = 0;
      } else {
        var p = parseFloat(v.replace('%', ''), 10);
        if (!isNaN(p)) {
          if (/%/.test(v) || p <= 10) { p = p <= 10 ? p : p / 100; }
          st.policy.roomCapPct = Math.max(0, Math.min(10, p));
        }
      }
    } else if (field === 'icuCapPct') {
      if (v.length > 0) { st.policy.icuCapLabel = v; }
    } else if (v.length > 0) {
      st.policy[field] = v;
    }
  }

  function renderConfirmCard() {
    var card = $('confirm-card');
    if (!card) { return; }
    CONFIRM_FIELDS.forEach(function (field) {
      var row = card.querySelector('[data-field="' + field + '"]');
      if (!row) { return; }
      var valueEl = row.querySelector('.confirm-value');
      if (valueEl) {
        valueEl.textContent = confirmValue(field);
      }
    });
  }

  function wireConfirmEdits() {
    var card = $('confirm-card');
    if (!card) { return; }
    card.addEventListener('click', function (e) {
      var btn = e.target.closest('.confirm-edit');
      if (!btn) { return; }
      var row = btn.closest('.confirm-row');
      var field = row.getAttribute('data-field');
      var main = row.querySelector('.confirm-main');
      var existing = main.querySelector('.confirm-input');
      if (existing) { existing.focus(); return; }
      var valueEl = main.querySelector('.confirm-value');
      if (!valueEl) { return; }
      var input = document.createElement('input');
      input.className = 'confirm-input num';
      input.type = 'text';
      input.value = field === 'sumInsured' ? String(st.policy.sumInsured) : confirmValue(field);
      input.setAttribute('aria-label', 'Edit ' + main.querySelector('.inphone-note-strong').textContent);
      valueEl.style.display = 'none';
      valueEl.insertAdjacentElement('afterend', input);
      var cancelled = false;
      input.focus();
      input.select();
      var commit = function () {
        commitConfirmed(field, input.value);
        input.remove();
        valueEl.style.display = '';
        renderConfirmCard();
        paintPolicyDependents();
      };
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
        if (ev.key === 'Escape') { cancelled = true; input.remove(); valueEl.style.display = ''; }
      });
      input.addEventListener('blur', function () {
        if (!cancelled) { commit(); }
      });
    });
  }

  function paintEstimate(res) {
    var el = $('adm-estimate');
    if (el) { el.textContent = fmt(res.totalBilled); }
  }

  function paintVerdict(res) {
    var insurer = $('v-insurer');
    if (!insurer) { return; }
    insurer.textContent = fmt(res.insurerPays);
    $('v-you').textContent = fmt(res.shortfall);

    var ratioPctText = pct(res.coverageRatio);
    $('ratio-fill').style.width = (res.coverageRatio * 100) + '%';
    var label = $('ratio-label');
    var note = $('ratio-note');
    if (st.policy.roomCapPct <= 0) {
      label.textContent = 'No proportionate deduction applies';
      note.textContent = 'This policy carries no room-rent cap.';
    } else if (res.coverageRatio >= 1) {
      label.textContent = 'No proportionate deduction applies';
      note.textContent = fmt(res.eligiblePerDay) + ' eligible meets or exceeds ' + fmt(st.admission.roomRatePerDay) + ' billed';
    } else {
      label.textContent = ratioPctText + ' coverage ratio';
      note.textContent = fmt(res.eligiblePerDay) + ' eligible \u00F7 ' + fmt(st.admission.roomRatePerDay) + ' billed';
    }

    $('c-room-b').textContent = fmt(res.roomBilled);
    $('c-room-p').textContent = fmt(res.roomPayable);
    $('c-room-y').textContent = fmt(res.roomBilled - res.roomPayable);
    $('c-assoc-b').textContent = fmt(res.associated);
    $('c-assoc-p').textContent = fmt(res.associatedPayable);
    $('c-assoc-y').textContent = fmt(res.associated - res.associatedPayable);
    $('c-prot-b').textContent = fmt(res.protectedTotal);
    $('c-prot-p').textContent = fmt(res.protectedPayable);
    $('c-prot-y').textContent = fmt(res.protectedTotal - res.protectedPayable);
    $('c-total-b').textContent = fmt(res.totalBilled);
    $('c-total-p').textContent = fmt(res.insurerPays);
    $('c-total-y').textContent = fmt(res.shortfall);

    $('callout-text').textContent = buildCallout(res);

    if (at('14-verdict')) {
      $('v-live').textContent =
        'Insurer pays ' + fmt(res.insurerPays) + '. You pay ' + fmt(res.shortfall) + '.';
    }
  }

  function buildCallout(res) {
    var ded = Math.round(res.deductionLoss);
    var sil = Math.round(res.sumInsuredLoss);
    var gap = Math.round(res.shortfall);
    var capOff = st.policy.roomCapPct <= 0;
    if (gap === 0 && ded === 0) {
      return capOff
        ? 'Nothing is deducted. This policy carries no room-rent cap, so no proportionate deduction can arise, and the whole bill sits inside the sum insured.'
        : 'Nothing is deducted. At this room rate the entire bill sits inside the policy.';
    }
    if (capOff) {
      if (sil > 0) {
        return 'This policy carries no room-rent cap, so no proportionate deduction arises. The entire ' + fmt(gap) + ' gap is the sum insured running out \u2014 a different problem, and no change of room fixes it.';
      }
      return 'This policy carries no room-rent cap, so no proportionate deduction arises.';
    }
    if (ded > 0 && sil === 0) {
      return fmt(ded) + ' of your ' + fmt(gap) + ' gap is the proportionate deduction \u2014 not an exclusion, not a rejection. Your claim is approved and this money still will not arrive.';
    }
    if (ded > 0 && sil > 0) {
      return fmt(ded) + ' of the gap is the proportionate deduction, and ' + fmt(sil) + ' is the sum insured running out. They are different problems with different remedies: the first is fixed by moving to a room at or under ' + fmt(res.eligiblePerDay) + ' a day; the second cannot be fixed at all.';
    }
    return fmt(sil) + ' of the gap is the sum insured running out \u2014 not an exclusion, not a rejection. No change of room fixes it.';
  }

  function paintActions(res) {
    var title = $('act1-title');
    if (!title) { return; }
    var capOff = st.policy.roomCapPct <= 0;
    var impact = $('act1-impact');
    var split = $('act1-split');
    if (capOff) {
      if (computeResult().shortfall > 0) {
        title.textContent = 'No change of room will close this gap';
        impact.textContent = fmt(0);
        split.textContent = 'No cap applies, so no proportionate deduction can arise \u2014 the entire gap is the sum insured running out.';
      } else {
        title.textContent = 'Any room works under this policy';
        impact.textContent = fmt(0);
        split.textContent = 'No room-rent cap, so no proportionate deduction can arise.';
      }
      return;
    }
    var eligible = Math.round(res.eligiblePerDay);
    title.textContent = 'Ask for a room at ' + fmt(eligible) + ' a day or less';
    if (res.coverageRatio >= 1) {
      impact.textContent = fmt(0);
      split.textContent = 'Already met \u2014 the billed rate sits inside the cap, so there is no gap to close.';
      return;
    }
    var alt = computeResult({ roomRatePerDay: eligible });
    var saving = Math.round(res.shortfall - alt.shortfall);
    var dedReversed = Math.round(
      (res.associated - res.associatedPayable) - (alt.associated - alt.associatedPayable)
    );
    var roomDelta = Math.round(res.roomBilled - alt.roomBilled);
    impact.textContent = fmt(saving);
    split.textContent = fmt(dedReversed) + ' is the deduction disappearing \u00B7 ' + fmt(roomDelta) + ' is the lower room charge itself';
  }

  function paintSegments(res) {
    var el = $('seg-sentence');
    if (!el) { return; }
    var eligible = res.eligiblePerDay;
    var segs = E.roomBySegments(
      [{ rate: 3000, days: 2 }, { rate: 8000, days: 3 }],
      eligible === Infinity ? Infinity : eligible
    );
    var r1 = E.formatPct(Math.min(1, eligible === Infinity ? 1 : eligible / 3000));
    var r2 = E.formatPct(Math.min(1, eligible === Infinity ? 1 : eligible / 8000));
    var first = r1 === '100%' ? 'Days 1\u20132 stay fully covered at 100%.' : 'Days 1\u20132 are covered at ' + r1 + '.';
    el.innerHTML = '';
    var text = document.createTextNode(
      'Room changed on day 3 \u2014 shared (\u20B93,000) to private (\u20B98,000). ' +
      first + ' Days 3\u20135 are covered at ' + r2 + '. '
    );
    el.appendChild(text);
    var paySpan = document.createElement('span');
    paySpan.className = 'num';
    paySpan.textContent = fmt(segs.payable);
    var mid = document.createTextNode(' of ');
    var billSpan = document.createElement('span');
    billSpan.className = 'num';
    billSpan.textContent = fmt(segs.billed);
    var tail = document.createTextNode(' billed.');
    el.appendChild(paySpan);
    el.appendChild(mid);
    el.appendChild(billSpan);
    el.insertBefore(document.createTextNode('Room payable '), paySpan);
    el.appendChild(tail);
  }

  function paintSettlement(res) {
    var b = $('f-billed');
    if (!b) { return; }
    b.textContent = fmt(res.totalBilled);
    $('f-paid').textContent = fmt(res.insurerPays);
    $('f-you').textContent = fmt(res.shortfall);
    var est = st.snapshot ? st.snapshot.shortfall : res.shortfall;
    $('c-est').textContent = fmt(est);
    $('c-act').textContent = fmt(res.shortfall);
    $('c-diff').textContent = fmt(res.shortfall - est);
  }

  // Screen 07 — layer the personal top-up over the employer settlement. The
  // employer figure is the same res the verdict uses; the combined figure comes
  // from E.combinePolicies() so no rupee is computed in app.js.
  function paintMultiPolicy(res) {
    var youEl = $('mp-you');
    if (!youEl) { return; }
    var employerPays = res.insurerPays;
    var topUpPays = 0;
    var youNow = res.shortfall;
    if (st.topUpOn) {
      var c = E.combinePolicies(res, TOPUP);
      topUpPays = c.topUpPays;
      youNow = c.combinedShortfall;
    }
    youEl.textContent = fmt(youNow);
    $('mp-employer').textContent = fmt(employerPays);
    $('mp-topup').textContent = st.topUpOn ? fmt(topUpPays) : '—';
    $('mp-combined').textContent = fmt(employerPays + topUpPays);
    var note = $('mp-note');
    if (note) {
      note.textContent = st.topUpOn
        ? 'Employer policy pays ' + fmt(employerPays) + '. The personal top-up absorbs ' +
          fmt(topUpPays) + ' of the remaining gap above its ' + fmt(TOPUP.deductible) +
          ' deductible, so ' + fmt(youNow) + ' is left for you.'
        : 'Employer policy only — ' + fmt(youNow) + ' is yours. Add the personal top-up to layer a second source over the same admission.';
    }
    if (at('07-multi-policy')) {
      var live = $('mp-live');
      if (live) {
        live.textContent = 'With ' + (st.topUpOn ? 'both policies' : 'the employer policy only') +
          ', you pay ' + fmt(youNow) + '.';
      }
    }
  }

  function syncMultiPolicy() {
    var chip = $('mp-chip-topup');
    if (!chip) { return; }
    chip.setAttribute('aria-pressed', st.topUpOn ? 'true' : 'false');
  }

  // Screen 11 — the ₹5,000/day figure as a clause-to-rupee chain. The result is
  // E.roomRentLineage(), the same arithmetic screen 10 and the verdict use.
  function paintLineage() {
    var result = $('lin-result');
    if (!result) { return; }
    var si = st.policy.sumInsured;
    var cap = st.policy.roomCapPct;
    var lin = E.roomRentLineage(si, cap);
    var capText = Math.round(cap * 100) / 100;
    if (lin.hasCap) {
      $('lin-clause').textContent =
        '“eligible room charges shall not exceed ' + capText + ' percent (' + capText +
        '%) of the Sum Insured per day”';
      $('lin-rule').textContent = 'ROOM_RENT_LIMIT = ' + capText + '% of sum insured, per day';
      $('lin-formula').textContent = 'eligible / day = sum insured × (' + capText + ' ÷ 100)';
      $('lin-calc').textContent = fmt(si) + ' × ' + capText + '%';
      result.textContent = fmt(lin.eligiblePerDay);
      $('lin-result-cap').textContent = 'eligible room rent, per day';
    } else {
      $('lin-clause').textContent =
        '“no ceiling is placed on eligible room charges under this policy”';
      $('lin-rule').textContent = 'ROOM_RENT_LIMIT = none';
      $('lin-formula').textContent = 'eligible / day = unlimited';
      $('lin-calc').textContent = 'no cap to apply';
      result.textContent = 'No daily limit';
      $('lin-result-cap').textContent = 'this policy has no room-rent clause';
    }
  }

  // Screen 18 — the same Sample A settlement, addressed to the admissions desk.
  // Every figure is the res the patient-facing verdict already produced.
  function paintTpaDesk(res) {
    var el = $('tpa-insurer');
    if (!el) { return; }
    el.textContent = fmt(res.insurerPays);
    $('tpa-patient').textContent = fmt(res.shortfall);
    $('tpa-billed').textContent = fmt(res.totalBilled);
    $('tpa-hospital').textContent = st.admission.hospital;
    $('tpa-city').textContent = st.admission.city;
    $('tpa-eligible').textContent =
      res.eligiblePerDay === Infinity ? 'No daily limit' : fmt(res.eligiblePerDay);
    $('tpa-ratio').textContent =
      st.policy.roomCapPct > 0 ? pct(res.coverageRatio) : 'n/a — no cap';
    var rule = $('tpa-rule');
    if (rule) {
      rule.textContent = st.policy.roomCapPct > 0
        ? 'ROOM_RENT_LIMIT ' + (Math.round(st.policy.roomCapPct * 100) / 100) + '% of ' +
          fmt(st.policy.sumInsured) + ' = ' + fmt(res.eligiblePerDay) + ' eligible/day; the ' +
          'proportionate deduction follows from the ' + fmt(st.admission.roomRatePerDay) + ' room rate.'
        : 'No room-rent cap on this policy, so no proportionate deduction arises at settlement.';
    }
  }

  function syncControls() {
    var room = $('v-room');
    if (!room) { return; }
    room.value = st.admission.roomRatePerDay;
    $('v-room-n').value = st.admission.roomRatePerDay;
    $('v-si').value = st.policy.sumInsured;
    $('v-si-n').value = st.policy.sumInsured;
    var capOff = st.policy.roomCapPct <= 0;
    var capSlider = $('v-cap');
    var capNum = $('v-cap-n');
    capSlider.disabled = capOff;
    capNum.disabled = capOff;
    capSlider.value = capOff ? capSlider.min : st.policy.roomCapPct;
    capNum.value = capOff ? '' : st.policy.roomCapPct;
    $('v-cap-note').hidden = !capOff;
    $('v-days').value = st.admission.days;
    $('v-days-n').value = st.admission.days;
    $('v-protected').checked = st.protectedOn;
  }

  function paintPolicyDependents() {
    var res = computeResult();
    paintDerived();
    renderConfirmCard();
    paintEstimate(res);
    paintVerdict(res);
    paintActions(res);
    paintSegments(res);
    paintSettlement(res);
    paintMultiPolicy(res);
    paintLineage();
    paintTpaDesk(res);
  }

  function recalcAll() {
    paintPolicyDependents();
    syncControls();
    syncSampleChips();
    syncMultiPolicy();
    syncHospital();
    syncAdmissionFields();
  }

  function syncAdmissionFields() {
    var rate = $('adm-rate');
    if (!rate) { return; }
    rate.value = st.admission.roomRatePerDay;
    $('adm-days').value = st.admission.days;
  }

  function syncSampleChips() {
    var wrap = $('sample-chips');
    if (!wrap) { return; }
    wrap.querySelectorAll('.chip').forEach(function (chip) {
      chip.setAttribute('aria-pressed', chip.getAttribute('data-sample') === st.sample ? 'true' : 'false');
    });
  }

  function applySample(key) {
    if (!SAMPLES[key]) { return; }
    st.sample = key;
    st.policy.sumInsured = SAMPLES[key].sumInsured;
    st.policy.roomCapPct = SAMPLES[key].roomCapPct;
    recalcAll();
  }

  function exclusiveSelect(wrap, attr, setter) {
    wrap.addEventListener('click', function (e) {
      var chip = e.target.closest('[aria-pressed]');
      if (!chip || !wrap.contains(chip)) { return; }
      wrap.querySelectorAll('[aria-pressed]').forEach(function (c) {
        c.setAttribute('aria-pressed', 'false');
      });
      chip.setAttribute('aria-pressed', 'true');
      setter(chip.getAttribute(attr));
    });
  }

  function applyHospital(key) {
    var h = HOSPITALS[key];
    if (!h) { return; }
    st.admission.hospitalKey = key;
    st.admission.hospital = h.name;
    st.admission.city = h.city;
    st.admission.roomRatePerDay = h.rate;
    recalcAll();
    recalcFromVerdictControls();
  }

  function syncHospital() {
    var list = $('hosp-list');
    if (!list) { return; }
    list.querySelectorAll('[aria-pressed]').forEach(function (row) {
      row.setAttribute(
        'aria-pressed',
        row.getAttribute('data-hosp') === st.admission.hospitalKey ? 'true' : 'false'
      );
    });
    $('adm-hospital').value = st.admission.hospital;
    $('adm-city').value = st.admission.city;
  }

  function bindPair(rangeId, numId, apply) {
    var range = $(rangeId);
    var num = $(numId);
    range.addEventListener('input', function () {
      num.value = range.value;
      apply(parseFloat(range.value, 10));
      recalcFromVerdictControls();
    });
    num.addEventListener('input', function () {
      var v = parseFloat(num.value, 10);
      if (!isNaN(v)) {
        var clamped = Math.min(parseFloat(num.max, 10), Math.max(parseFloat(num.min, 10), v));
        range.value = clamped;
        apply(clamped);
        recalcFromVerdictControls();
      }
    });
    num.addEventListener('change', function () {
      var v = parseFloat(num.value, 10);
      if (isNaN(v)) {
        num.value = range.value;
        return;
      }
      var clamped = Math.min(parseFloat(num.max, 10), Math.max(parseFloat(num.min, 10), v));
      num.value = clamped;
      range.value = clamped;
      apply(clamped);
      recalcFromVerdictControls();
    });
  }

  function recalcFromVerdictControls() {
    var res = computeResult();
    paintEstimate(res);
    paintVerdict(res);
    paintActions(res);
    paintSegments(res);
    paintSettlement(res);
    paintMultiPolicy(res);
    paintLineage();
    paintTpaDesk(res);
  }

  function startResendCountdown() {
    var el = $('resend');
    var n = 30;
    clearInterval(startResendCountdown.t);
    el.disabled = true;
    el.textContent = 'Resend available in ' + n + 's';
    startResendCountdown.t = setInterval(function () {
      n -= 1;
      if (n <= 0) {
        clearInterval(startResendCountdown.t);
        el.disabled = false;
        el.textContent = 'Resend code';
      } else {
        el.textContent = 'Resend available in ' + n + 's';
      }
    }, 1000);
  }

  var EXTRACT_FIELDS = 7;

  function stopExtract() {
    clearInterval(extractTimer);
    extractTimer = null;
  }

  function finishExtract() {
    stopExtract();
    st.readingDone = true;
    var list = $('extract-list');
    list.querySelectorAll('li').forEach(function (li) { li.classList.remove('pending'); });
    var fill = $('extract-fill');
    fill.style.width = '100%';
    var bar = $('extract-progress');
    bar.setAttribute('aria-valuenow', '100');
    $('extract-continue').disabled = false;
  }

  function startExtract() {
    if (st.readingDone) {
      finishExtract();
      return;
    }
    stopExtract();
    var list = $('extract-list');
    list.querySelectorAll('li').forEach(function (li) { li.classList.add('pending'); });
    var fill = $('extract-fill');
    fill.style.width = '0%';
    $('extract-progress').setAttribute('aria-valuenow', '0');
    $('extract-continue').disabled = true;
    if (REDUCED) {
      finishExtract();
      return;
    }
    var step = 0;
    extractTimer = setInterval(function () {
      step += 1;
      var items = list.querySelectorAll('li');
      for (var i = 0; i < step && i < items.length; i++) {
        items[i].classList.remove('pending');
      }
      fill.style.width = Math.round((step / EXTRACT_FIELDS) * 100) + '%';
      $('extract-progress').setAttribute('aria-valuenow', String(Math.round((step / EXTRACT_FIELDS) * 100)));
      if (step >= EXTRACT_FIELDS) {
        finishExtract();
      }
    }, 360);
  }

  function updateChrome(i) {
    $('subnav-phase').textContent = SCREENS[i].phase;
    document.querySelectorAll('.dot').forEach(function (dot, di) {
      dot.classList.toggle('is-current', di === i);
      dot.classList.toggle('is-done', di < i);
      if (di === i) {
        dot.setAttribute('aria-current', 'step');
      } else {
        dot.removeAttribute('aria-current');
      }
    });
    $('sb-count').textContent =
      'Screen ' + (i + 1) + ' of ' + SCREENS.length + ' \u00B7 ' + SCREENS[i].title;
    var back = $('sb-back');
    var atStart = i === 0;
    back.classList.toggle('btn-back-disabled', atStart);
    back.setAttribute('aria-disabled', atStart ? 'true' : 'false');
    $('sb-next').textContent = i === SCREENS.length - 1 ? 'Start over' : 'Continue';
  }

  function showTile(i) {
    tiles.forEach(function (tile, ti) {
      if (ti === i) {
        tile.hidden = false;
        tile.classList.remove('enter');
        void tile.offsetWidth;
        tile.classList.add('enter');
      } else {
        tile.hidden = true;
        tile.classList.remove('enter');
      }
    });
  }

  function render(i) {
    currentIndex = i;
    if (at('14-verdict') && !st.snapshot) {
      captureSnapshot();
    }
    showTile(i);
    updateChrome(i);
    if (at('08-reading')) {
      startExtract();
    } else {
      stopExtract();
    }
    if (at('03-verify') && !st.resendStarted) {
      st.resendStarted = true;
      startResendCountdown();
    }
    recalcAll();
    window.scrollTo(0, 0);
  }

  function parseHash() {
    var m = /^#\/(\d{2})-/.exec(window.location.hash);
    if (!m) { return 0; }
    var n = parseInt(m[1], 10);
    return n >= 1 && n <= SCREENS.length ? n - 1 : 0;
  }

  function goto(i) {
    if (typeof i === 'string') { i = indexOf(i); }
    i = Math.max(0, Math.min(SCREENS.length - 1, i));
    var target = '#/' + SCREENS[i].slug;
    if (window.location.hash === target) {
      render(i);
    } else {
      window.location.hash = target;
    }
  }

  function resetDemo() {
    st = seedState();
    $('reg-mobile').value = '';
    $('reg-send').disabled = true;
    for (var k = 1; k <= 6; k++) {
      var box = $('otp-' + k);
      box.value = '';
    }
    $('otp-continue').disabled = true;
    $('consent-read').checked = false;
    $('consent-check').checked = false;
    $('consent-keep').checked = false;
    $('consent-continue').disabled = true;
    $('withdraw-msg').hidden = true;
    $('pat-name').value = '';
    $('pat-age').value = '';
    $('pat-abha').value = '';
    $('file-chosen').hidden = true;
    document.querySelectorAll('#rel-chips .chip').forEach(function (c) {
      c.setAttribute('aria-pressed', c.getAttribute('data-rel') === 'Parent' ? 'true' : 'false');
    });
    document.querySelectorAll('#proc-chips .chip').forEach(function (c) {
      c.setAttribute('aria-pressed', c.getAttribute('data-proc') === 'Cardiac' ? 'true' : 'false');
    });
    document.querySelectorAll('#roomcat-chips .chip').forEach(function (c) {
      c.setAttribute('aria-pressed', c.getAttribute('data-roomcat') === 'Single private' ? 'true' : 'false');
    });
    goto(0);
    recalcAll();
  }

  function isTypingTarget(el) {
    if (!el) { return false; }
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function bind() {
    tiles = Array.prototype.slice.call(document.querySelectorAll('.tile'));

    document.querySelectorAll('.dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        goto(parseInt(dot.getAttribute('data-goto'), 10));
      });
    });

    $('gn-home').addEventListener('click', function () { goto(0); });
    $('gn-restart').addEventListener('click', resetDemo);
    $('hero-start').addEventListener('click', function () { goto(1); });
    $('launch-start').addEventListener('click', function () { goto(1); });

    $('what-not-toggle').addEventListener('click', function () {
      var panel = $('what-not');
      panel.hidden = !panel.hidden;
      this.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    });

    document.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () { goto(currentIndex - 1); });
    });

    $('reg-mobile').addEventListener('input', function () {
      var digits = this.value.replace(/\D/g, '').slice(0, 10);
      this.value = digits;
      st.mobile = digits;
      $('reg-send').disabled = digits.length !== 10;
    });
    $('reg-send').addEventListener('click', function () {
      goto(2);
      startResendCountdown();
      $('otp-1').focus();
    });

    var boxes = [];
    for (var k = 1; k <= 6; k++) { boxes.push($('otp-' + k)); }
    function otpValue() {
      return boxes.map(function (b) { return b.value; }).join('');
    }
    function otpGate() {
      $('otp-continue').disabled = !/^\d{6}$/.test(otpValue());
    }
    boxes.forEach(function (box, bi) {
      box.addEventListener('input', function () {
        var d = box.value.replace(/\D/g, '');
        box.value = d.charAt(d.length - 1);
        if (box.value && bi < 5) { boxes[bi + 1].focus(); }
        otpGate();
      });
      box.addEventListener('keydown', function (ev) {
        if (ev.key === 'Backspace' && !box.value && bi > 0) {
          boxes[bi - 1].focus();
          boxes[bi - 1].value = '';
          otpGate();
          ev.preventDefault();
        }
      });
      box.addEventListener('paste', function (ev) {
        var text = (ev.clipboardData || window.clipboardData).getData('text') || '';
        var digits = text.replace(/\D/g, '').slice(0, 6);
        if (!digits) { return; }
        ev.preventDefault();
        for (var j = 0; j < 6; j++) {
          boxes[j].value = digits.charAt(j) || '';
        }
        boxes[Math.min(digits.length, 5)].focus();
        otpGate();
      });
    });
    $('otp-continue').addEventListener('click', function () { goto(3); });
    $('change-number').addEventListener('click', function () { goto(1); });
    $('resend').addEventListener('click', function () {
      if (!this.disabled) { startResendCountdown(); }
    });

    function consentGate() {
      st.consents = {
        read: $('consent-read').checked,
        check: $('consent-check').checked,
        keep: $('consent-keep').checked
      };
      $('consent-continue').disabled = !(st.consents.read && st.consents.check);
    }
    ['consent-read', 'consent-check', 'consent-keep'].forEach(function (id) {
      $(id).addEventListener('change', consentGate);
    });
    $('withdraw-consent').addEventListener('click', function () {
      $('consent-read').checked = false;
      $('consent-check').checked = false;
      $('consent-keep').checked = false;
      consentGate();
      var msg = $('withdraw-msg');
      msg.hidden = false;
      msg.textContent = 'Consent withdrawn. Nothing further can be read until the purposes are ticked again.';
    });
    $('consent-continue').addEventListener('click', function () { goto(4); });

    exclusiveSelect($('rel-chips'), 'data-rel', function (v) { st.relationship = v; });
    $('pat-name').addEventListener('input', function () { st.patientName = this.value; });
    $('pat-age').addEventListener('input', function () { st.patientAge = this.value; });
    $('pat-abha').addEventListener('input', function () { st.abhaId = this.value; });
    $('abha-toggle').addEventListener('click', function () {
      var note = $('abha-note');
      note.hidden = !note.hidden;
      this.setAttribute('aria-expanded', note.hidden ? 'false' : 'true');
    });
    $('patient-continue').addEventListener('click', function () { goto(5); });

    var zone = $('drop-zone');
    var fileInput = $('policy-file');
    zone.addEventListener('click', function () { fileInput.click(); });
    zone.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      zone.classList.add('is-over');
    });
    zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
    zone.addEventListener('drop', function (ev) {
      ev.preventDefault();
      zone.classList.remove('is-over');
      var f = ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) { chooseFile(f.name); }
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) {
        chooseFile(fileInput.files[0].name);
      }
    });
    function chooseFile(name) {
      st.fileName = name;
      $('file-chosen').hidden = false;
      $('file-chosen-name').textContent = name + ' \u00B7 kept on this device only';
    }
    exclusiveSelect($('sample-chips'), 'data-sample', applySample);
    $('policy-continue').addEventListener('click', function () { goto('07-multi-policy'); });

    // Screen 07 — the top-up chip toggles a second coverage source on and off.
    var mpTopUp = $('mp-chip-topup');
    if (mpTopUp) {
      mpTopUp.addEventListener('click', function () {
        st.topUpOn = !st.topUpOn;
        syncMultiPolicy();
        paintMultiPolicy(computeResult());
      });
    }
    $('multi-continue').addEventListener('click', function () { goto('08-reading'); });

    $('extract-skip').addEventListener('click', function () {
      finishExtract();
      goto('09-confirm');
    });
    $('extract-continue').addEventListener('click', function () { goto('09-confirm'); });

    wireConfirmEdits();
    $('confirm-continue').addEventListener('click', function () { goto('10-plain-terms'); });

    $('wording-toggle').addEventListener('click', function () {
      var w = $('wording');
      w.hidden = !w.hidden;
      this.setAttribute('aria-expanded', w.hidden ? 'false' : 'true');
    });
    $('plain-continue').addEventListener('click', function () { goto('11-lineage'); });

    $('lineage-continue').addEventListener('click', function () { goto('12-hospital'); });

    exclusiveSelect($('hosp-list'), 'data-hosp', applyHospital);
    $('hospital-continue').addEventListener('click', function () { goto('13-admission'); });

    // Hospital and city are derived from the screen-10 pick, so they are read-only here;
    // the "Change" link is the only way to alter them.
    document.querySelectorAll('[data-goto-slug]').forEach(function (el) {
      el.addEventListener('click', function () { goto(el.getAttribute('data-goto-slug')); });
    });
    exclusiveSelect($('proc-chips'), 'data-proc', function (v) { st.admission.procedure = v; });
    exclusiveSelect($('roomcat-chips'), 'data-roomcat', function (v) { st.admission.roomCategory = v; });
    $('adm-rate').addEventListener('input', function () {
      var v = parseFloat(this.value, 10);
      if (!isNaN(v) && v > 0) {
        st.admission.roomRatePerDay = v;
        recalcFromVerdictControls();
      }
    });
    $('adm-days').addEventListener('input', function () {
      var v = parseFloat(this.value, 10);
      if (!isNaN(v) && v >= 1) {
        st.admission.days = Math.floor(v);
        recalcFromVerdictControls();
      }
    });
    $('admission-check').addEventListener('click', function () {
      captureSnapshot();
      goto('14-verdict');
    });

    bindPair('v-room', 'v-room-n', function (v) { st.admission.roomRatePerDay = v; });
    bindPair('v-si', 'v-si-n', function (v) { st.policy.sumInsured = v; });
    bindPair('v-cap', 'v-cap-n', function (v) { st.policy.roomCapPct = v; });
    bindPair('v-days', 'v-days-n', function (v) { st.admission.days = Math.round(v); });
    $('v-protected').addEventListener('change', function () {
      st.protectedOn = this.checked;
      recalcFromVerdictControls();
    });
    $('v-reset').addEventListener('click', function () {
      st.sample = 'A';
      st.policy.sumInsured = SAMPLES.A.sumInsured;
      st.policy.roomCapPct = SAMPLES.A.roomCapPct;
      st.admission.days = WORKED_CASE.days;
      st.protectedOn = true;
      // WORKED_CASE.roomRatePerDay is Sample General's tariff, so the hospital
      // pick and the room rate go back to the worked case together.
      applyHospital('sample-general');
    });

    $('sb-back').addEventListener('click', function () {
      if (currentIndex > 0) { goto(currentIndex - 1); }
    });
    $('sb-next').addEventListener('click', function () {
      if (currentIndex === SCREENS.length - 1) {
        resetDemo();
      } else {
        goto(currentIndex + 1);
      }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) { return; }
      if (isTypingTarget(ev.target)) { return; }
      if (ev.key === 'ArrowRight') {
        goto(currentIndex + 1);
      } else if (ev.key === 'ArrowLeft') {
        goto(currentIndex - 1);
      }
    });

    window.addEventListener('hashchange', function () {
      render(parseHash());
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    render(parseHash());
  });
})();
