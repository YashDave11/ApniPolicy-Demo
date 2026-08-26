/* Constellation mesh background — vanilla port of constellation-grid.tsx.
   Light mode only, monochrome (black on white), fixed behind all content.
   Spring-mass-damping nodes; cursor sweeps push kinetic shockwaves through the grid. */
(function () {
  'use strict';

  var canvas = document.getElementById('constellation');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var BG = '#ffffff';
  var INK = '10, 10, 10';
  var SPACING = 56;
  var MAX_CONN = 84;     // > spacing*√2 (79.2), so diagonals web up too
  var MAX_CONN_SQ = MAX_CONN * MAX_CONN;
  var SPRING_K = 18;
  var DAMPING = 0.82;

  var width = 0, height = 0, dpr = 1;
  var nodes = [];
  var links = [];        // precomputed neighbour pairs; O(n) instead of O(n^2) per frame
  var rafId = 0;

  var mouse = { x: -1e4, y: -1e4, prevX: -1e4, prevY: -1e4, vx: 0, vy: 0, radius: 220 };

  function initNodes() {
    nodes = [];
    links = [];
    var cols = Math.ceil(width / SPACING) + 1;
    var rows = Math.ceil(height / SPACING) + 1;

    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        nodes.push({
          x: i * SPACING, y: j * SPACING,
          baseX: i * SPACING, baseY: j * SPACING,
          vx: 0, vy: 0,
          radius: Math.random() * 1.1 + 1.1,
          pulse: Math.random() * Math.PI * 2
        });
      }
    }

    // Only immediate grid neighbours can ever fall inside MAX_CONN, so pair them once.
    var idx = function (c, r) { return c * rows + r; };
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var a = idx(c, r);
        if (c + 1 < cols) links.push([a, idx(c + 1, r)]);
        if (r + 1 < rows) links.push([a, idx(c, r + 1)]);
        if (c + 1 < cols && r + 1 < rows) links.push([a, idx(c + 1, r + 1)]);
        if (c + 1 < cols && r > 0) links.push([a, idx(c + 1, r - 1)]);
      }
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initNodes();
    if (REDUCED) paint(0);
  }

  function step(dt) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.pulse += dt * 2.2;

      var dx = mouse.x - n.x;
      var dy = mouse.y - n.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < mouse.radius && dist > 0) {
        var force = (1 - dist / mouse.radius) * (1200 + mouse.speed * 140);
        n.vx -= (dx / dist) * force * dt;
        n.vy -= (dy / dist) * force * dt;
      }

      n.vx += (n.baseX - n.x) * SPRING_K * dt;
      n.vy += (n.baseY - n.y) * SPRING_K * dt;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx * dt * 60;
      n.y += n.vy * dt * 60;
    }
  }

  function paint() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 0.7;
    for (var k = 0; k < links.length; k++) {
      var a = nodes[links[k][0]], b = nodes[links[k][1]];
      var ldx = a.x - b.x, ldy = a.y - b.y;
      var dsq = ldx * ldx + ldy * ldy;
      if (dsq >= MAX_CONN_SQ) continue;
      var alpha = (1 - Math.sqrt(dsq) / MAX_CONN) * 0.5;
      ctx.strokeStyle = 'rgba(' + INK + ',' + alpha + ')';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var dx = mouse.x - n.x, dy = mouse.y - n.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var near = dist < mouse.radius;

      var alpha2 = near
        ? 0.24 + (1 - dist / mouse.radius) * 0.6
        : 0.2 + Math.sin(n.pulse) * 0.06;
      var radius = near
        ? n.radius * (1 + (1 - dist / mouse.radius) * 1.1)
        : n.radius + Math.sin(n.pulse) * 0.25;

      ctx.fillStyle = 'rgba(' + INK + ',' + alpha2 + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(0.5, radius), 0, Math.PI * 2);
      ctx.fill();

      // Single expanding ring under the cursor, in ink — no accent hue, no readouts.
      if (dist < 100) {
        var ring = ((n.pulse * 16) % 30) + 4;
        ctx.strokeStyle = 'rgba(' + INK + ',' + (1 - ring / 34) * 0.22 + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, ring, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    mouse.vx = (mouse.x - mouse.prevX) / (dt * 1000 || 1);
    mouse.vy = (mouse.y - mouse.prevY) / (dt * 1000 || 1);
    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    mouse.speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);

    step(dt);
    paint();
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', function () { mouse.x = -1e4; mouse.y = -1e4; });
  document.addEventListener('visibilitychange', function () {
    if (REDUCED) return;
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!rafId) {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  });

  mouse.speed = 0;
  resize();
  if (!REDUCED) rafId = requestAnimationFrame(frame);

  // Self-check: link count must match the 4-direction neighbour formula for the grid.
  (function selfTest() {
    var rows = Math.ceil(height / SPACING) + 1;
    var cols = Math.ceil(width / SPACING) + 1;
    var expected = cols * (rows - 1) + rows * (cols - 1) + 2 * (cols - 1) * (rows - 1);
    var ok = links.length === expected && nodes.length === cols * rows;
    console.log('constellation self-test: ' + (ok ? 'PASS' : 'FAIL') +
      ' · ' + nodes.length + ' nodes, ' + links.length + '/' + expected + ' links');
  })();
})();
