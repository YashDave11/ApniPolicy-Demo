(function (root) {
  'use strict';

  function formatINR(value) {
    var n = Math.round(Number(value) || 0);
    var sign = n < 0 ? '-' : '';
    var digits = Math.abs(n).toString();
    var out;
    if (digits.length <= 3) {
      out = digits;
    } else {
      var last3 = digits.slice(-3);
      var rest = digits.slice(0, -3);
      var groups = [];
      while (rest.length > 2) {
        groups.unshift(rest.slice(-2));
        rest = rest.slice(0, -2);
      }
      if (rest.length > 0) {
        groups.unshift(rest);
      }
      out = groups.join(',') + ',' + last3;
    }
    return '\u20B9' + sign + out;
  }

  function formatPct(ratio) {
    var v = Math.round(ratio * 1000) / 10;
    return (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)) + '%';
  }

  function computeCoverage(input) {
    var sumInsured = input.sumInsured;
    var capPct = input.roomCapPct > 0 ? input.roomCapPct : 0;
    var roomRatePerDay = input.roomRatePerDay || 0;
    var days = input.days || 0;

    var associated = input.associatedExpenses || 0;
    var pharmacy = input.pharmacy || 0;
    var implants = input.implants || 0;
    var diagnostics = input.diagnostics || 0;
    var icu = input.icu || 0;
    var protectedOn = input.protectedHeadsApplied !== false;

    var protectedTotal = pharmacy + implants + diagnostics + icu;

    var eligiblePerDay = capPct > 0 ? sumInsured * (capPct / 100) : Infinity;
    var coverageRatio =
      capPct > 0 && roomRatePerDay > 0
        ? Math.min(1, eligiblePerDay / roomRatePerDay)
        : 1;

    var roomBilled = roomRatePerDay * days;
    var roomPayable = Math.min(roomRatePerDay, eligiblePerDay) * days;

    var protectedPayable = protectedOn ? protectedTotal : protectedTotal * coverageRatio;
    var associatedPayable = associated * coverageRatio;

    var totalBilled = roomBilled + associated + protectedTotal;
    var grossPayable = roomPayable + associatedPayable + protectedPayable;
    var insurerPays = Math.min(grossPayable, sumInsured);
    var shortfall = totalBilled - insurerPays;

    var deductionLoss =
      associated - associatedPayable +
      (protectedOn ? 0 : protectedTotal - protectedPayable) +
      roomBilled - roomPayable;
    var sumInsuredLoss = Math.max(0, grossPayable - sumInsured);

    return {
      eligiblePerDay: eligiblePerDay,
      coverageRatio: coverageRatio,
      roomBilled: roomBilled,
      roomPayable: roomPayable,
      associated: associated,
      protectedTotal: protectedTotal,
      protectedPayable: protectedPayable,
      associatedPayable: associatedPayable,
      totalBilled: totalBilled,
      grossPayable: grossPayable,
      insurerPays: insurerPays,
      shortfall: shortfall,
      deductionLoss: deductionLoss,
      sumInsuredLoss: sumInsuredLoss
    };
  }

  function roomBySegments(segments, eligiblePerDay) {
    var billed = 0;
    var payable = 0;
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      billed += seg.rate * seg.days;
      payable += Math.min(seg.rate, eligiblePerDay) * seg.days;
    }
    return { billed: billed, payable: payable };
  }

  // Multi-policy layering. A super-top-up pays the primary policy's residual
  // shortfall above a fixed deductible, capped at its own sum insured. Nothing
  // here re-derives the primary settlement; it only stacks a second source on
  // top of a result computeCoverage() already produced.
  function combinePolicies(primary, topUp) {
    var residual = primary.shortfall;
    var deductible = topUp && topUp.deductible > 0 ? topUp.deductible : 0;
    var topUpCeiling = topUp && topUp.sumInsured > 0 ? topUp.sumInsured : 0;
    var topUpEligible = Math.max(0, residual - deductible);
    var topUpPays = Math.max(0, Math.min(topUpEligible, topUpCeiling));
    var combinedInsurerPays = primary.insurerPays + topUpPays;
    return {
      primaryPays: primary.insurerPays,
      topUpPays: topUpPays,
      topUpDeductible: deductible,
      combinedInsurerPays: combinedInsurerPays,
      combinedShortfall: primary.totalBilled - combinedInsurerPays,
      totalBilled: primary.totalBilled
    };
  }

  // Clause-to-rupee lineage for the eligible daily room rent. Same arithmetic
  // computeCoverage() uses for eligiblePerDay, exposed as its own step so the
  // lineage screen can show where the figure comes from without re-deriving it
  // anywhere else.
  function roomRentLineage(sumInsured, capPct) {
    var hasCap = capPct > 0;
    return {
      sumInsured: sumInsured,
      capPct: hasCap ? capPct : 0,
      hasCap: hasCap,
      eligiblePerDay: hasCap ? sumInsured * (capPct / 100) : Infinity
    };
  }

  var DEMO_CASE = {
    sumInsured: 500000,
    roomCapPct: 1,
    roomRatePerDay: 8000,
    days: 5,
    associatedExpenses: 150000,
    pharmacy: 40000,
    implants: 0,
    diagnostics: 0,
    icu: 60000,
    protectedHeadsApplied: true
  };

  function cloneMerge(overrides) {
    var o = {};
    for (var k in DEMO_CASE) {
      o[k] = k in overrides ? overrides[k] : DEMO_CASE[k];
    }
    return o;
  }

  // Run computeCoverage() for the worked case with a different daily room rate
  // (and optional other admission overrides). Shared by the room-type and
  // hospital comparisons so neither forks the deduction math.
  function scenarioFor(roomPerDay, baseOverrides) {
    var ov = {};
    if (baseOverrides) {
      for (var k in baseOverrides) { ov[k] = baseOverrides[k]; }
    }
    ov.roomRatePerDay = roomPerDay;
    return computeCoverage(cloneMerge(ov));
  }

  // Financial Digital Twin: the same admission priced across room categories.
  // A costlier room does not buy more cover once the per-day cap bites, so the
  // ratio falls and youPay rises as the room rate climbs above eligiblePerDay.
  function roomTypeScenarios(roomTypes, baseOverrides) {
    var types = roomTypes || [
      { label: 'General ward', roomPerDay: 3000 },
      { label: 'Twin-sharing', roomPerDay: 5000 },
      { label: 'Private room', roomPerDay: 8000 }
    ];
    var out = [];
    for (var i = 0; i < types.length; i++) {
      var r = scenarioFor(types[i].roomPerDay, baseOverrides);
      out.push({
        label: types[i].label,
        roomPerDay: types[i].roomPerDay,
        eligiblePerDay: r.eligiblePerDay,
        ratio: r.coverageRatio,
        insurerPays: r.insurerPays,
        youPay: r.shortfall
      });
    }
    return out;
  }

  // The same admission priced at every hospital in the picker, so all rows show
  // a real, comparable outcome — not just the one that happens to be selected.
  function hospitalScenarios(hospitals, baseOverrides) {
    var out = [];
    for (var i = 0; i < hospitals.length; i++) {
      var h = hospitals[i];
      var r = scenarioFor(h.roomPerDay, baseOverrides);
      out.push({
        key: h.key,
        name: h.name,
        city: h.city,
        roomPerDay: h.roomPerDay,
        eligiblePerDay: r.eligiblePerDay,
        ratio: r.coverageRatio,
        insurerPays: r.insurerPays,
        youPay: r.shortfall
      });
    }
    return out;
  }

  // Continuous claim memory: how close past estimates landed to the actual
  // settled figure. Pure summary over a synthetic history; no forecasting.
  function claimMemoryInsight(history, band) {
    var b = band > 0 ? band : 0.1;
    var n = history.length;
    var sumErr = 0;
    var within = 0;
    for (var i = 0; i < n; i++) {
      var e = history[i].estimate;
      var a = history[i].actual;
      var pct = a !== 0 ? Math.abs(a - e) / Math.abs(a) : 0;
      sumErr += pct;
      if (pct <= b) { within++; }
    }
    return {
      count: n,
      meanAbsPctError: n ? sumErr / n : 0,
      withinBandRate: n ? within / n : 0,
      band: b
    };
  }

  function approx(actual, expected) {
    return Math.abs(actual - expected) < 0.000001;
  }

  function runSelfTest() {
    var results = [];

    function check(name, fn) {
      try {
        var failures = fn() || [];
        results.push({ name: name, pass: failures.length === 0, detail: failures.join('; ') });
      } catch (e) {
        results.push({ name: name, pass: false, detail: String(e) });
      }
    }

    function expect(label, actual, expected, fails) {
      if (!approx(actual, expected)) {
        fails.push(label + ' expected ' + expected + ', got ' + actual);
      }
    }

    check('vector 1 - demo main case', function () {
      var r = computeCoverage(DEMO_CASE);
      var f = [];
      expect('eligiblePerDay', r.eligiblePerDay, 5000, f);
      expect('coverageRatio', r.coverageRatio, 0.625, f);
      expect('roomBilled', r.roomBilled, 40000, f);
      expect('roomPayable', r.roomPayable, 25000, f);
      expect('associatedPayable', r.associatedPayable, 93750, f);
      expect('protectedPayable', r.protectedPayable, 100000, f);
      expect('totalBilled', r.totalBilled, 290000, f);
      expect('insurerPays', r.insurerPays, 218750, f);
      expect('shortfall', r.shortfall, 71250, f);
      return f;
    });

    check('vector 2 - deck headline chain', function () {
      var r = computeCoverage(cloneMerge({
        days: 0,
        pharmacy: 0,
        icu: 0,
        protectedHeadsApplied: false
      }));
      var f = [];
      expect('eligiblePerDay', r.eligiblePerDay, 5000, f);
      expect('coverageRatio', r.coverageRatio, 0.625, f);
      expect('associatedPayable', r.associatedPayable, 93750, f);
      expect('shortfall', r.shortfall, 56250, f);
      return f;
    });

    check('vector 3 - room within the cap', function () {
      var base = computeCoverage(DEMO_CASE);
      var alt = computeCoverage(cloneMerge({ roomRatePerDay: 5000 }));
      var f = [];
      expect('coverageRatio', alt.coverageRatio, 1, f);
      expect('totalBilled', alt.totalBilled, 275000, f);
      expect('insurerPays', alt.insurerPays, 275000, f);
      expect('shortfall', alt.shortfall, 0, f);
      var saving = base.shortfall - alt.shortfall;
      var deductionReversed =
        (base.associated - base.associatedPayable) -
        (alt.associated - alt.associatedPayable);
      var roomChargeDelta = base.roomBilled - alt.roomBilled;
      expect('saving', saving, 71250, f);
      expect('deductionReversed', deductionReversed, 56250, f);
      expect('roomChargeDelta', roomChargeDelta, 15000, f);
      expect('decomposition sums', saving, deductionReversed + roomChargeDelta, f);
      return f;
    });

    check('vector 4 - protected heads are load-bearing', function () {
      var on = computeCoverage(DEMO_CASE);
      var off = computeCoverage(cloneMerge({ protectedHeadsApplied: false }));
      var f = [];
      expect('protectedPayable off', off.protectedPayable, 62500, f);
      expect('carve-out worth', on.protectedPayable - off.protectedPayable, 37500, f);
      return f;
    });

    check('vector 5 - sample B higher cap', function () {
      var r = computeCoverage(cloneMerge({
        sumInsured: 1000000,
        roomCapPct: 2
      }));
      var f = [];
      expect('eligiblePerDay', r.eligiblePerDay, 20000, f);
      expect('coverageRatio', r.coverageRatio, 1, f);
      expect('shortfall', r.shortfall, 0, f);
      return f;
    });

    check('vector 6 - sum insured exhausted', function () {
      var r = computeCoverage(cloneMerge({
        sumInsured: 200000,
        roomCapPct: 1,
        roomRatePerDay: 4000,
        days: 10,
        associatedExpenses: 500000,
        pharmacy: 0,
        icu: 0,
        protectedHeadsApplied: false
      }));
      var f = [];
      expect('coverageRatio', r.coverageRatio, 0.5, f);
      expect('grossPayable', r.grossPayable, 270000, f);
      expect('insurerPays', r.insurerPays, 200000, f);
      expect('totalBilled', r.totalBilled, 540000, f);
      expect('shortfall', r.shortfall, 340000, f);
      expect('sumInsuredLoss', r.sumInsuredLoss, 70000, f);
      return f;
    });

    check('per-day segments - mid-stay room change', function () {
      var s = roomBySegments(
        [{ rate: 3000, days: 2 }, { rate: 8000, days: 3 }],
        5000
      );
      var f = [];
      expect('billed', s.billed, 30000, f);
      expect('payable', s.payable, 21000, f);
      return f;
    });

    check('multi-policy - top-up pays above its deductible', function () {
      var primary = computeCoverage(DEMO_CASE);
      var c = combinePolicies(primary, { sumInsured: 500000, deductible: 50000 });
      var f = [];
      expect('primaryPays', c.primaryPays, 218750, f);
      expect('topUpPays', c.topUpPays, 21250, f);
      expect('combinedInsurerPays', c.combinedInsurerPays, 240000, f);
      expect('combinedShortfall', c.combinedShortfall, 50000, f);
      // A deductible larger than the gap leaves the top-up paying nothing.
      var none = combinePolicies(primary, { sumInsured: 500000, deductible: 100000 });
      expect('topUpPays under-deductible', none.topUpPays, 0, f);
      expect('combinedShortfall under-deductible', none.combinedShortfall, 71250, f);
      return f;
    });

    check('room-rent lineage - clause to rupee', function () {
      var f = [];
      var lin = roomRentLineage(500000, 1);
      expect('eligiblePerDay', lin.eligiblePerDay, 5000, f);
      if (lin.hasCap !== true) { f.push('hasCap expected true'); }
      var noCap = roomRentLineage(300000, 0);
      if (noCap.eligiblePerDay !== Infinity) {
        f.push('no-cap eligiblePerDay expected Infinity, got ' + noCap.eligiblePerDay);
      }
      if (noCap.hasCap !== false) { f.push('no-cap hasCap expected false'); }
      return f;
    });

    check('formatINR - Indian lakh grouping', function () {
      var f = [];
      function eq(got, want) {
        if (got !== want) { f.push('expected "' + want + '", got "' + got + '"'); }
      }
      eq(formatINR(500000), '\u20B95,00,000');
      eq(formatINR(218750), '\u20B92,18,750');
      eq(formatINR(71250), '\u20B971,250');
      eq(formatINR(56250), '\u20B956,250');
      eq(formatINR(290000), '\u20B92,90,000');
      eq(formatINR(0), '\u20B90');
      eq(formatINR(999), '\u20B9999');
      eq(formatINR(12000000), '\u20B91,20,00,000');
      return f;
    });

    check('room-type scenarios - cap bites as room climbs', function () {
      var f = [];
      var rows = roomTypeScenarios();
      if (rows.length !== 3) { f.push('expected 3 rows, got ' + rows.length); }
      expect('general ratio', rows[0].ratio, 1, f);
      expect('general youPay', rows[0].youPay, 0, f);
      expect('twin ratio', rows[1].ratio, 1, f);
      expect('private ratio', rows[2].ratio, 0.625, f);
      expect('private youPay', rows[2].youPay, 71250, f);
      if (!(rows[2].ratio < rows[0].ratio)) {
        f.push('private ratio should be below general ratio');
      }
      return f;
    });

    check('hospital scenarios - every row a real outcome', function () {
      var f = [];
      var rows = hospitalScenarios([
        { key: 'a', name: 'Alpha', city: 'Pune', roomPerDay: 5000 },
        { key: 'b', name: 'Beta', city: 'Delhi', roomPerDay: 8000 }
      ]);
      expect('within-cap youPay', rows[0].youPay, 0, f);
      expect('over-cap youPay', rows[1].youPay, 71250, f);
      expect('over-cap insurerPays', rows[1].insurerPays, 218750, f);
      if (rows[1].key !== 'b' || rows[1].city !== 'Delhi') {
        f.push('hospital identity not carried through');
      }
      return f;
    });

    check('claim memory - mean error and within-band rate', function () {
      var f = [];
      var m = claimMemoryInsight([
        { estimate: 90, actual: 100 },
        { estimate: 100, actual: 100 }
      ]);
      expect('count', m.count, 2, f);
      expect('meanAbsPctError', m.meanAbsPctError, 0.05, f);
      expect('withinBandRate', m.withinBandRate, 1, f);
      expect('band default', m.band, 0.1, f);
      return f;
    });

    var allPass = true;
    for (var i = 0; i < results.length; i++) {
      var t = results[i];
      if (!t.pass) { allPass = false; }
      root.console.log(
        '[engine] ' + (t.pass ? 'PASS' : 'FAIL') + ' - ' + t.name + (t.pass ? '' : ' (' + t.detail + ')')
      );
    }
    root.console.log('[engine] self-test ' + (allPass ? 'complete: all vectors pass' : 'complete: FAILURES above'));
    return allPass;
  }

  var api = {
    computeCoverage: computeCoverage,
    roomBySegments: roomBySegments,
    combinePolicies: combinePolicies,
    roomRentLineage: roomRentLineage,
    roomTypeScenarios: roomTypeScenarios,
    hospitalScenarios: hospitalScenarios,
    claimMemoryInsight: claimMemoryInsight,
    formatINR: formatINR,
    formatPct: formatPct,
    DEMO_CASE: DEMO_CASE,
    runSelfTest: runSelfTest
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ApniPolicyEngine = api;
    // Log all coverage vectors to the console on page load.
    runSelfTest();
  }
})(typeof window !== 'undefined' ? window : globalThis);
