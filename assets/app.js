(function () {
  'use strict';

  var E = window.ApniPolicyEngine;
  var G = window.gsap || null;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Register every vendored plugin once. Guarded so the demo still runs if a
  // plugin file is missing — animation just degrades to none.
  if (G && G.registerPlugin) {
    var plugins = [];
    if (window.ScrollTrigger) { plugins.push(window.ScrollTrigger); }
    if (window.Flip) { plugins.push(window.Flip); }
    if (window.MotionPathPlugin) { plugins.push(window.MotionPathPlugin); }
    if (window.DrawSVGPlugin) { plugins.push(window.DrawSVGPlugin); }
    if (window.SplitText) { plugins.push(window.SplitText); }
    if (plugins.length) { G.registerPlugin.apply(G, plugins); }
  }

  var SCREENS = [
    { slug: '01-arrive', title: 'Arrive', phase: 'Get set up' },
    { slug: '02-register', title: 'Register and verify', phase: 'Get set up' },
    { slug: '03-consent', title: 'Consent', phase: 'Get set up' },
    { slug: '04-patient', title: 'Who you are admitting', phase: 'Get set up' },
    { slug: '05-policy', title: 'Add the policy', phase: 'Add your policy' },
    { slug: '06-multi-policy', title: 'Multiple policies, one estimate', phase: 'Add your policy' },
    { slug: '07-reading', title: 'Reading it', phase: 'Add your policy' },
    { slug: '08-confirm', title: 'Confirm what we read', phase: 'Add your policy' },
    { slug: '09-plain-terms', title: 'Your policy, in plain terms', phase: 'Add your policy' },
    { slug: '10-multilingual', title: 'The same number, every language', phase: 'Add your policy' },
    { slug: '11-lineage', title: 'Where this number comes from', phase: 'Add your policy' },
    { slug: '12-hospital', title: 'Choose the hospital', phase: 'Check an admission' },
    { slug: '13-admission', title: 'Start an admission', phase: 'Check an admission' },
    { slug: '14-twin', title: 'Room-type digital twin', phase: 'Check an admission' },
    { slug: '15-verdict', title: 'The verdict', phase: 'Check an admission' },
    { slug: '16-next-steps', title: 'What to do now', phase: 'Check an admission' },
    { slug: '17-settlement', title: 'Settlement', phase: 'Through the stay' },
    { slug: '18-claim-memory', title: 'Claim memory', phase: 'Through the stay' },
    { slug: '19-tpa-desk', title: 'Hospital / TPA desk view', phase: 'Through the stay' },
    { slug: '20-interop', title: 'How it connects', phase: 'Through the stay' }
  ];

  // Screens the code has to recognise by name. Indices shift whenever a screen is
  // inserted; slugs do not.
  function at(slug) { return currentIndex === indexOf(slug); }
  function indexOf(slug) {
    // Match the full slug or just its descriptive suffix, so callers can name a
    // screen by suffix ('verdict') and stay correct when the numeric prefix
    // shifts on a reorder. Only the SCREENS array carries the position number.
    for (var i = 0; i < SCREENS.length; i++) {
      if (SCREENS[i].slug === slug ||
          SCREENS[i].slug.replace(/^\d+-/, '') === slug) { return i; }
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

  // Synthetic record the on-device ABDM consent pull writes into the patient
  // fields. No network; nothing here is a real person.
  var ABDM_RECORD = { name: 'Sunita Devi', age: '61', abha: '14-1234-5678-9012' };

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

  // Per-field extraction confidence and the clause each value was read from.
  // Synthetic provenance for the demo: fields below CONFIRM_THRESHOLD are the
  // two the confirm screen already flags with "Check this". These are
  // extraction labels, not coverage arithmetic, so they live here, not in the
  // engine.
  var CONFIRM_META = {
    sumInsured:     { confidence: 0.99, clause: 'Schedule — Sum Insured' },
    roomCapPct:     { confidence: 0.72, clause: 'Section III.1 — Room Rent' },
    icuCapPct:      { confidence: 0.68, clause: 'Section III.2 — ICU charges' },
    copay:          { confidence: 0.97, clause: 'Schedule — Co-pay' },
    initialWaiting: { confidence: 0.98, clause: 'Section IV.1 — Waiting periods' },
    pedWaiting:     { confidence: 0.95, clause: 'Section IV.3 — Pre-existing diseases' },
    roomCategory:   { confidence: 0.90, clause: 'Schedule — Room eligibility' }
  };
  var CONFIRM_THRESHOLD = 0.85;

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
      paintConfirmConfidence(row, field, valueEl);
    });
  }

  // Draw the confidence bar + source-clause line for one field, building the
  // markup on first paint so the HTML stays free of seven repeated blocks.
  function paintConfirmConfidence(row, field, valueEl) {
    var meta = CONFIRM_META[field];
    if (!meta || !valueEl) { return; }
    var block = row.querySelector('.confirm-conf');
    if (!block) {
      block = document.createElement('div');
      block.className = 'confirm-conf';
      block.innerHTML =
        '<div class="ratio-track"><div class="ratio-fill"></div></div>' +
        '<p class="confirm-clause"></p>';
      valueEl.insertAdjacentElement('afterend', block);
    }
    block.querySelector('.ratio-fill').style.width =
      Math.round(meta.confidence * 100) + '%';
    var flagged = meta.confidence < CONFIRM_THRESHOLD;
    block.querySelector('.confirm-clause').textContent =
      'read at ' + Math.round(meta.confidence * 100) + '% confidence' +
      (flagged ? ' — below threshold' : '') + ' · ' + meta.clause;
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

    if (at('verdict')) {
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

  // Financial digital twin: the worked admission priced across three room
  // categories at once. Numbers come from E.roomTypeScenarios(); app.js only
  // fills the DOM and promotes the active card (with Flip when available).
  var TWIN_ROOMS = [
    { label: 'General ward', roomPerDay: 3000 },
    { label: 'Twin-sharing', roomPerDay: 5000 },
    { label: 'Private room', roomPerDay: 8000 }
  ];
  var twinActive = 2;

  function twinOverrides() {
    return {
      sumInsured: st.policy.sumInsured,
      roomCapPct: st.policy.roomCapPct,
      days: st.admission.days,
      protectedHeadsApplied: st.protectedOn
    };
  }

  function paintTwin() {
    var host = $('twin-cards');
    if (!host) { return; }
    var rows = E.roomTypeScenarios(TWIN_ROOMS, twinOverrides());
    if (!host.children.length) {
      for (var j = 0; j < rows.length; j++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'twin-card';
        btn.setAttribute('data-twin', String(j));
        btn.innerHTML =
          '<span class="twin-head"><span class="twin-label"></span>' +
          '<span class="twin-rate num"></span></span>' +
          '<span class="ratio-track"><span class="ratio-fill"></span></span>' +
          '<span class="twin-foot"><span class="twin-ratio"></span>' +
          '<span class="twin-you">You pay <span class="num"></span></span></span>';
        host.appendChild(btn);
      }
    }
    var cards = host.querySelectorAll('.twin-card');
    for (var i = 0; i < cards.length; i++) {
      var r = rows[i];
      var c = cards[i];
      var active = i === twinActive;
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-pressed', active ? 'true' : 'false');
      c.querySelector('.twin-label').textContent = r.label;
      c.querySelector('.twin-rate').textContent = fmt(r.roomPerDay) + '/day';
      c.querySelector('.ratio-fill').style.width = Math.round(r.ratio * 100) + '%';
      c.querySelector('.twin-ratio').textContent = E.formatPct(r.ratio) + ' covered';
      c.querySelector('.twin-you .num').textContent = fmt(r.youPay);
    }
  }

  function setTwinActive(i) {
    if (i === twinActive) { return; }
    var host = $('twin-cards');
    var doFlip = G && !REDUCED && window.Flip && host;
    var state = doFlip ? window.Flip.getState(host.querySelectorAll('.twin-card, .ratio-fill')) : null;
    twinActive = i;
    paintTwin();
    if (doFlip) {
      window.Flip.from(state, { duration: 0.5, ease: 'power2.out', absolute: false });
    }
  }

  // Multilingual explanation. Three reviewed sentences share one {fig} slot; the
  // engine computes the figure once and formatINR renders it identically, so the
  // rupee amount is byte-for-byte the same in every language.
  var LANG_SENTENCES = {
    en: 'Of the hospital bill, your policy pays the eligible part. After the room-rent cap, the amount you pay is {fig}.',
    hi: 'अस्पताल के बिल में से, आपकी पॉलिसी पात्र हिस्सा चुकाती है। कमरे के किराए की सीमा के बाद, आप {fig} चुकाते हैं।',
    mr: 'रुग्णालयाच्या बिलातून, तुमची पॉलिसी पात्र भाग भरते. खोली भाड्याच्या मर्यादेनंतर, तुम्ही {fig} भरता.'
  };
  var mlLang = 'en';

  function paintMultilingual(animate) {
    var el = $('ml-sentence');
    if (!el) { return; }
    var fig = fmt(computeResult().shortfall);
    var parts = LANG_SENTENCES[mlLang].split('{fig}');
    el.innerHTML = '';
    el.setAttribute('lang', mlLang);
    el.appendChild(document.createTextNode(parts[0]));
    var num = document.createElement('span');
    num.className = 'num';
    num.textContent = fig;
    el.appendChild(num);
    el.appendChild(document.createTextNode(parts[1] || ''));
    if (animate && G && !REDUCED && window.SplitText) {
      var split = new window.SplitText(el, { type: 'words' });
      G.from(split.words, { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out', stagger: 0.012 });
    }
  }

  function setLang(code) {
    if (!LANG_SENTENCES[code]) { return; }
    mlLang = code;
    var chips = $('lang-chips').querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      var on = chips[i].getAttribute('data-lang') === code;
      chips[i].classList.toggle('is-selected', on);
      chips[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    paintMultilingual(true);
  }

  // Continuous claim memory. A synthetic history of past pre-admission estimates
  // against the figure that actually settled; E.claimMemoryInsight() summarises
  // accuracy. Labelled synthetic — no forecasting, no promise about this case.
  var CLAIM_HISTORY = [
    { estimate: 68000, actual: 71250 },
    { estimate: 120000, actual: 118000 },
    { estimate: 45000, actual: 52000 },
    { estimate: 210000, actual: 205000 },
    { estimate: 90000, actual: 88000 },
    { estimate: 156000, actual: 150000 },
    { estimate: 32000, actual: 30000 },
    { estimate: 275000, actual: 300000 }
  ];

  function countUp(el, to, render) {
    if (!el) { return; }
    if (!G || REDUCED) { el.textContent = render(to); return; }
    var obj = { v: 0 };
    G.to(obj, {
      v: to, duration: 0.9, ease: 'power2.out',
      onUpdate: function () { el.textContent = render(obj.v); }
    });
  }

  function paintClaimMemory(animate) {
    var host = $('cm-list');
    if (!host) { return; }
    var insight = E.claimMemoryInsight(CLAIM_HISTORY, 0.1);
    if (animate) {
      countUp($('cm-band-rate'), insight.withinBandRate * 100, function (v) { return Math.round(v) + '%'; });
    } else {
      $('cm-band-rate').textContent = Math.round(insight.withinBandRate * 100) + '%';
    }
    $('cm-count').textContent = insight.count;
    $('cm-mean-err').textContent = E.formatPct(insight.meanAbsPctError);
    if (!host.children.length) {
      for (var i = 0; i < CLAIM_HISTORY.length; i++) {
        var h = CLAIM_HISTORY[i];
        var pct = h.actual !== 0 ? Math.abs(h.actual - h.estimate) / Math.abs(h.actual) : 0;
        var li = document.createElement('li');
        li.className = 'cm-row' + (pct <= insight.band ? ' is-within' : '');
        li.innerHTML =
          '<span class="cm-pair">Estimated <span class="num">' + fmt(h.estimate) +
          '</span> → settled <span class="num">' + fmt(h.actual) + '</span></span>' +
          '<span class="cm-err">' + E.formatPct(pct) +
          (pct <= insight.band ? ' · within band' : ' · over band') + '</span>';
        host.appendChild(li);
      }
    }
  }

  // Interoperability diagram. DrawSVG traces the spine, the nodes fade in, and a
  // pulse rides the path via MotionPath. Under reduced motion (or missing
  // plugins) the spine and nodes are simply shown in place, pulse parked at top.
  var interopTl = null;
  function animateInterop() {
    var svg = $('io-diagram');
    if (!svg) { return; }
    if (interopTl) { interopTl.kill(); interopTl = null; }
    if (!G || REDUCED) { return; }
    G.killTweensOf('#io-pulse');
    interopTl = G.timeline();
    if (window.DrawSVGPlugin) {
      interopTl.from('#io-spine', { drawSVG: '0%', duration: 1.0, ease: 'power1.inOut' }, 0);
    }
    interopTl.from(svg.querySelectorAll('.io-node'), {
      opacity: 0, x: -8, duration: 0.42, ease: 'power2.out', stagger: 0.12
    }, 0.25);
    if (window.MotionPathPlugin) {
      G.set('#io-pulse', { opacity: 1 });
      G.to('#io-pulse', {
        motionPath: { path: '#io-spine', align: '#io-spine', alignOrigin: [0.5, 0.5] },
        duration: 2.6, repeat: -1, ease: 'none', delay: 0.9
      });
    }
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
    if (at('multi-policy')) {
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

  // Screen 11 — reveal the clause-to-rupee chain as a build: each card fades up,
  // then DrawSVG traces the connector to the next link. Under reduced motion (or
  // missing GSAP/DrawSVG) every card and connector is simply shown in place.
  var lineageTl = null;
  function animateLineage() {
    var sec = document.querySelector('[data-slug="11-lineage"]');
    if (!sec) { return; }
    if (lineageTl) { lineageTl.kill(); lineageTl = null; }
    if (!G || REDUCED) { return; }
    var cards = sec.querySelectorAll('.util-card, .hero-fig');
    var connectors = sec.querySelectorAll('.lineage-arrow path');
    G.killTweensOf(cards);
    G.killTweensOf(connectors);
    lineageTl = G.timeline();
    lineageTl.from(cards, {
      opacity: 0, y: 10, duration: 0.4, ease: 'power2.out', stagger: 0.28
    }, 0);
    if (window.DrawSVGPlugin) {
      lineageTl.from(connectors, {
        drawSVG: '0%', duration: 0.32, ease: 'power1.inOut', stagger: 0.28
      }, 0.22);
    }
  }


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
    paintTwin();
    paintMultilingual(false);
  }

  function recalcAll() {
    paintPolicyDependents();
    syncControls();
    syncSampleChips();
    syncMultiPolicy();
    syncHospital();
    paintHospitals();
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

  // Every hospital row shows its own real outcome, not just the selected one —
  // E.hospitalScenarios() prices the same admission at each tariff so the list
  // is a genuine comparison. Figures track the live policy inputs.
  function paintHospitals() {
    var list = $('hosp-list');
    if (!list) { return; }
    var hosps = [];
    for (var k in HOSPITALS) {
      var h = HOSPITALS[k];
      hosps.push({ key: k, name: h.name, city: h.city, roomPerDay: h.rate });
    }
    var rows = E.hospitalScenarios(hosps, {
      sumInsured: st.policy.sumInsured,
      roomCapPct: st.policy.roomCapPct,
      days: st.admission.days,
      protectedHeadsApplied: st.protectedOn
    });
    var byKey = {};
    for (var i = 0; i < rows.length; i++) { byKey[rows[i].key] = rows[i]; }
    list.querySelectorAll('.hosp').forEach(function (btn) {
      var r = byKey[btn.getAttribute('data-hosp')];
      if (!r) { return; }
      var main = btn.querySelector('.hosp-main');
      var out = btn.querySelector('.hosp-outcome');
      if (!out) {
        out = document.createElement('span');
        out.className = 'hosp-outcome';
        main.appendChild(out);
      }
      out.innerHTML = r.youPay > 0
        ? 'You pay <span class="num">' + fmt(r.youPay) + '</span> · ' + E.formatPct(r.ratio) + ' covered'
        : 'Fully covered · nothing deducted';
    });
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
    paintTwin();
    paintMultilingual(false);
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

  var entranceTl = null;

  // GSAP entrance timeline: the narrative rises in a stagger, the phone follows.
  // Replaces the old .tile.enter CSS keyframes. Any in-flight timeline is killed
  // on switch so a fast Back/Continue never leaves a half-faded column behind.
  // Under reduced motion (or if GSAP failed to load) elements simply stay at
  // their natural, fully-visible state — no motion, nothing hidden.
  function playEntrance(tile) {
    if (entranceTl) { entranceTl.kill(); entranceTl = null; }
    var narrative = tile.querySelectorAll('.narrative > *');
    var phone = tile.querySelector('.phone-col');
    if (!G || REDUCED) {
      if (G) { G.set([].slice.call(narrative).concat(phone ? [phone] : []), { clearProps: 'all' }); }
      return;
    }
    entranceTl = G.timeline();
    if (narrative.length) {
      entranceTl.from(narrative, {
        opacity: 0, y: 14, duration: 0.62, ease: 'power2.out',
        stagger: 0.05, clearProps: 'transform'
      }, 0);
    }
    if (phone) {
      entranceTl.from(phone, {
        opacity: 0, y: 22, scale: 0.985, duration: 0.76, ease: 'power2.out',
        clearProps: 'transform'
      }, 0.09);
    }
  }

  function showTile(i) {
    tiles.forEach(function (tile, ti) {
      tile.hidden = ti !== i;
    });
    playEntrance(tiles[i]);
  }

  function render(i) {
    currentIndex = i;
    if (at('verdict') && !st.snapshot) {
      captureSnapshot();
    }
    showTile(i);
    updateChrome(i);
    if (at('reading')) {
      startExtract();
    } else {
      stopExtract();
    }
    if (at('multilingual')) {
      paintMultilingual(true);
    }
    if (at('claim-memory')) {
      paintClaimMemory(true);
    }
    if (at('interop')) {
      animateInterop();
    }
    if (at('lineage')) {
      animateLineage();
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
    // Register+verify share one screen — return it to the number-entry panel.
    $('reg-panel-number').hidden = false;
    $('reg-panel-otp').hidden = true;
    $('reg-send').hidden = false;
    $('otp-continue').hidden = true;
    $('reg-phone-title').textContent = 'Your mobile number';
    $('consent-read').checked = false;
    $('consent-check').checked = false;
    $('consent-keep').checked = false;
    $('consent-continue').disabled = true;
    $('withdraw-msg').hidden = true;
    $('pat-name').value = '';
    $('pat-age').value = '';
    $('pat-abha').value = '';
    $('abdm-consent').hidden = true;
    $('abdm-status').hidden = true;
    $('abdm-pull').disabled = false;
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
    // Register + verify live on one screen: sending the code swaps the phone's
    // number panel for the OTP panel in place, rather than navigating.
    function showRegPanel(which) {
      var otp = which === 'otp';
      $('reg-panel-number').hidden = otp;
      $('reg-panel-otp').hidden = !otp;
      $('reg-send').hidden = otp;
      $('otp-continue').hidden = !otp;
      $('reg-phone-title').textContent = otp ? 'Enter the code' : 'Your mobile number';
    }
    $('reg-send').addEventListener('click', function () {
      showRegPanel('otp');
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
    $('otp-continue').addEventListener('click', function () { goto('consent'); });
    $('change-number').addEventListener('click', function () { showRegPanel('number'); $('reg-mobile').focus(); });
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
    $('consent-continue').addEventListener('click', function () { goto('patient'); });

    exclusiveSelect($('rel-chips'), 'data-rel', function (v) { st.relationship = v; });
    $('pat-name').addEventListener('input', function () { st.patientName = this.value; });
    $('pat-age').addEventListener('input', function () { st.patientAge = this.value; });
    $('pat-abha').addEventListener('input', function () { st.abhaId = this.value; });
    // Consent-based ABDM pull, simulated entirely on-device. "Fetch" opens a
    // consent-request artefact (who, purpose, data, validity) mirroring the real
    // ABDM consent-manager step; only Grant writes the synthetic record into the
    // fields. No network — the record never leaves here.
    var abdmPull = $('abdm-pull');
    if (abdmPull) {
      var abdmCard = $('abdm-consent');
      var abdmStatus = $('abdm-status');
      abdmPull.addEventListener('click', function () {
        abdmStatus.hidden = true;
        abdmCard.hidden = false;
        $('abdm-grant').focus();
      });
      $('abdm-grant').addEventListener('click', function () {
        abdmCard.hidden = true;
        $('pat-name').value = ABDM_RECORD.name;
        st.patientName = ABDM_RECORD.name;
        $('pat-age').value = ABDM_RECORD.age;
        st.patientAge = ABDM_RECORD.age;
        if (!$('pat-abha').value) {
          $('pat-abha').value = ABDM_RECORD.abha;
          st.abhaId = ABDM_RECORD.abha;
        }
        abdmStatus.hidden = false;
        abdmStatus.textContent = 'Consent granted · demographics pulled from ABDM (synthetic record, on-device)';
      });
      $('abdm-deny').addEventListener('click', function () {
        abdmCard.hidden = true;
        abdmStatus.hidden = false;
        abdmStatus.textContent = 'Consent declined — nothing was pulled.';
        abdmPull.focus();
      });
    }
    $('abha-toggle').addEventListener('click', function () {
      var note = $('abha-note');
      note.hidden = !note.hidden;
      this.setAttribute('aria-expanded', note.hidden ? 'false' : 'true');
    });
    $('patient-continue').addEventListener('click', function () { goto('policy'); });

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
    $('policy-continue').addEventListener('click', function () { goto('multi-policy'); });

    // Screen 07 — the top-up chip toggles a second coverage source on and off.
    var mpTopUp = $('mp-chip-topup');
    if (mpTopUp) {
      mpTopUp.addEventListener('click', function () {
        st.topUpOn = !st.topUpOn;
        syncMultiPolicy();
        paintMultiPolicy(computeResult());
      });
    }
    $('multi-continue').addEventListener('click', function () { goto('reading'); });

    $('extract-skip').addEventListener('click', function () {
      finishExtract();
      goto('confirm');
    });
    $('extract-continue').addEventListener('click', function () { goto('confirm'); });

    wireConfirmEdits();
    $('confirm-continue').addEventListener('click', function () { goto('plain-terms'); });

    $('wording-toggle').addEventListener('click', function () {
      var w = $('wording');
      w.hidden = !w.hidden;
      this.setAttribute('aria-expanded', w.hidden ? 'false' : 'true');
    });
    $('plain-continue').addEventListener('click', function () { goto('multilingual'); });

    var langChips = $('lang-chips');
    if (langChips) {
      langChips.addEventListener('click', function (ev) {
        var chip = ev.target.closest('.chip');
        if (chip) { setLang(chip.getAttribute('data-lang')); }
      });
    }
    $('multilingual-continue').addEventListener('click', function () { goto('lineage'); });

    $('lineage-continue').addEventListener('click', function () { goto('hospital'); });

    exclusiveSelect($('hosp-list'), 'data-hosp', applyHospital);
    $('hospital-continue').addEventListener('click', function () { goto('admission'); });

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
      goto('twin');
    });

    // Room-type twin: promote a card (Flip-animated) and move on to the verdict.
    var twinHost = $('twin-cards');
    if (twinHost) {
      twinHost.addEventListener('click', function (ev) {
        var card = ev.target.closest('.twin-card');
        if (card) { setTwinActive(parseInt(card.getAttribute('data-twin'), 10)); }
      });
    }
    $('twin-continue').addEventListener('click', function () { goto('verdict'); });

    var cmContinue = $('claim-memory-continue');
    if (cmContinue) { cmContinue.addEventListener('click', function () { goto('tpa-desk'); }); }

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
