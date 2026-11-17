/* Dashboard for the FBA normalization model. All numbers come from model.js. */
(function () {
  'use strict';
  var F = window.FBAModel;
  function $(id) { return document.getElementById(id); }

  var MODELS = ['none', 'stim', 'cort'];
  var NAMES = { none: 'No attention', stim: 'Stimulus-based', cort: 'Cortical-based' };
  var COLOR = { none: 'var(--none)', stim: 'var(--stim)', cort: 'var(--cort)' };
  var LFD0 = -3, LFD1 = 4;                 // displayed SF range, log2 cpd (0.125 to 16)
  var SF_TICKS = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
  var CS = [], CFINE = [], i;
  for (i = 0; i < 9; i++) CS.push(Math.pow(10, -2 + i * 0.25));          // tested contrasts, 1 to 100%
  for (i = 0; i <= 80; i++) CFINE.push(Math.pow(10, -2.06 + i * 2.06 / 80));
  var TLF = [];
  for (i = 0; i <= 112; i++) TLF.push(LFD0 + i * 0.0625);
  var SW_NE = 48, SW_NK = 57, SW_DLF = 0.125;

  var MEAS = {
    c50: { short: 'c50 reduction', long: 'Contrast gain: reduction in c50 (%)', tile: 'c50 reduction' },
    rmax: { short: 'Rmax increase', long: 'Response gain: increase in Rmax (%)', tile: 'Rmax change' },
    resp: { short: 'response increase', long: 'Change in response at the probe contrast (%)', tile: 'response change' }
  };

  // ---------- formatting ----------
  function fSF(f) { return f < 9.95 ? f.toFixed(2) : f.toFixed(1); }
  function fPct(c) { var p = c * 100; return (p < 9.95 ? p.toFixed(1) : p.toFixed(0)) + '%'; }
  function fC50(c) { return (c * 100).toFixed(1) + '%'; }
  function fDeg(e) { return (Math.abs(e - Math.round(e)) < 1e-9 ? e.toFixed(0) : e.toFixed(2).replace(/0$/, '')) + '°'; }
  function signed(v, d) { if (!isFinite(v)) return '–'; return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d); }
  function plain(v, d) { if (!isFinite(v)) return '–'; return (v < 0 ? '−' : '') + Math.abs(v).toFixed(d); }
  function effect(q, base, val) { return q === 'c50' ? 100 * (1 - val / base) : 100 * (val / base - 1); }

  // ---------- controls ----------
  function p2(v) { return Math.pow(2, v); }
  var SPEC = {
    attention: [
      { id: 'gain', label: 'Attentional gain at the ridge', min: 1, max: 4, step: 0.05, def: 2, fmt: function (v) { return v.toFixed(2) + '×'; } },
      { id: 'fAtt', label: 'Attended spatial frequency', min: -2, max: 3, step: 0.05, def: 1, tf: p2, fmt: function (v) { return fSF(v) + ' cpd'; } },
      { id: 'eAtt', label: 'Attended eccentricity', min: 0.5, max: 10, step: 0.25, def: 2, fmt: fDeg },
      { id: 'sigAf', label: 'Width of the attention field in SF', min: 0.2, max: 2, step: 0.05, def: 0.5, fmt: function (v) { return v.toFixed(2) + ' oct'; } }
    ],
    probe: [
      { id: 'pe', label: 'Eccentricity', min: 0.5, max: 11, step: 0.25, def: 6, fmt: fDeg },
      { id: 'pf', label: 'Spatial frequency', min: -2, max: 3, step: 0.05, def: 1, tf: p2, fmt: function (v) { return fSF(v) + ' cpd'; } },
      { id: 'pc', label: 'Contrast', min: -2, max: 0, step: 0.02, def: -0.52, tf: function (v) { return Math.pow(10, v); }, fmt: fPct },
      { id: 'psize', label: 'Size', min: 0.5, max: 12.5, step: 0.5, def: 2, tf: function (v) { return v > 12 ? F.FULL_FIELD : v; }, fmt: function (v) { return v >= F.FULL_FIELD ? 'full field' : v.toFixed(1) + '°'; } },
      { id: 'pbw', label: 'SF bandwidth', min: 0, max: 2, step: 0.05, def: 0, fmt: function (v) { return v === 0 ? 'grating' : v.toFixed(2) + ' oct'; } }
    ],
    voxel: [
      { id: 'sigVox', label: 'SF band the voxel reads out', min: 0.2, max: 2.5, step: 0.05, def: 1.5, fmt: function (v) { return v.toFixed(2) + ' oct'; } }
    ],
    norm: [
      { id: 'sigma', label: 'Semi-saturation σ', min: 0.02, max: 0.5, step: 0.01, def: 0.1, fmt: fPct },
      { id: 'n', label: 'Exponent n', min: 1, max: 3, step: 0.1, def: 2, fmt: function (v) { return v.toFixed(1); } },
      { id: 'sigSf', label: 'Suppressive pool width in SF', min: 0.5, max: 4, step: 0.1, def: 2, fmt: function (v) { return v.toFixed(1) + ' oct'; } },
      { id: 'sigSx', label: 'Suppressive pool width on cortex', min: 1, max: 12, step: 0.5, def: 4, fmt: function (v) { return v.toFixed(1) + ' mm'; } }
    ],
    pop: [
      { id: 'sigT', label: 'Unit SF tuning width', min: 0.3, max: 1.2, step: 0.05, def: 0.6, fmt: function (v) { return v.toFixed(2) + ' oct'; } },
      { id: 'sigPop', label: 'Spread of preferred SFs in the pool', min: 0.5, max: 2.5, step: 0.1, def: 1.5, fmt: function (v) { return v.toFixed(1) + ' oct'; } },
      { id: 'e2', label: 'Magnification constant e₂', min: 0.3, max: 3, step: 0.05, def: 0.75, fmt: function (v) { return v.toFixed(2) + '°'; } },
      { id: 'a', label: 'Preferred period, slope', min: 0.05, max: 0.25, step: 0.01, def: 0.12, fmt: function (v) { return v.toFixed(2) + '°/°'; } },
      { id: 'b', label: 'Preferred period at the fovea', min: 0.15, max: 0.8, step: 0.01, def: 0.35, fmt: function (v) { return v.toFixed(2) + '°'; } }
    ]
  };
  var V = {}, CTL = [];
  var S = { measure: 'c50', axis: 'ecc', view: 'field', cortRule: 'mag' };

  function buildControls() {
    Object.keys(SPEC).forEach(function (g) {
      var host = $('grp-' + g);
      host.style.display = 'flex'; host.style.flexDirection = 'column'; host.style.gap = '10px';
      SPEC[g].forEach(function (c) {
        var row = document.createElement('div'); row.className = 'ctl';
        var lab = document.createElement('label'); lab.htmlFor = 'c-' + c.id; lab.textContent = c.label;
        var out = document.createElement('output'); out.id = 'o-' + c.id; out.htmlFor = 'c-' + c.id;
        var inp = document.createElement('input');
        inp.type = 'range'; inp.id = 'c-' + c.id; inp.min = c.min; inp.max = c.max; inp.step = c.step; inp.value = c.def;
        inp.addEventListener('input', request);
        row.appendChild(lab); row.appendChild(out); row.appendChild(inp); host.appendChild(row);
        CTL.push({ c: c, inp: inp, out: out });
      });
    });
    ['measure', 'axis', 'view', 'cortRule'].forEach(function (name) {
      Array.prototype.forEach.call(document.getElementsByName(name), function (el) {
        el.addEventListener('change', function () {
          if (!el.checked) return;
          S[name] = el.value;
          if (name === 'view') { renderMaps(); return; }
          request();
        });
      });
    });
    $('reset').addEventListener('click', function () {
      CTL.forEach(function (k) { k.inp.value = k.c.def; });
      $('rule-mag').checked = true; S.cortRule = 'mag';
      request();
    });
  }
  function readControls() {
    CTL.forEach(function (k) {
      var raw = parseFloat(k.inp.value);
      V[k.c.id] = k.c.tf ? k.c.tf(raw) : raw;
      k.out.textContent = k.c.fmt(V[k.c.id]);
    });
  }
  function stim() { return { e: V.pe, f: V.pf, c: V.pc, size: V.psize, bw: V.pbw }; }

  // ---------- model state ----------
  var model = null, fast = null, sweep = null;
  function axisU(e) { return S.axis === 'cortex' ? model.xOf(e) / model.xMax : e / F.E_MAX; }
  function axisInv(u) { return S.axis === 'cortex' ? model.eOf(u * model.xMax) : u * F.E_MAX; }
  function eccTicks() { return S.axis === 'cortex' ? [0, 0.5, 1, 2, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12]; }

  function computeFast() {
    var st = stim(), prof = model.sfProfile(1, st.f, st.bw), out = { st: st, res: {}, tun: {} };
    var profs = TLF.map(function (lf) { return model.sfProfile(1, Math.pow(2, lf), st.bw); });
    MODELS.forEach(function (m) {
      var col = model.probeColumn(m, st.e, st.size);
      var u = model.units(col, prof), r = model.crf(u, CS);
      out.res[m] = { ys: r.ys, fit: r.fit, c50: r.fit.c50, rmax: r.fit.rmax, resp: model.pooledAt(u, st.c) };
      var t = { c50: [], rmax: [], resp: [] };
      profs.forEach(function (pf) {
        var uu = model.units(col, pf), rr = model.crf(uu, CS);
        t.c50.push(rr.fit.c50); t.rmax.push(rr.fit.rmax); t.resp.push(model.pooledAt(uu, st.c));
      });
      out.tun[m] = t;
    });
    out.ridge = { stim: model.ridgeSF('stim', st.e), cort: model.ridgeSF('cort', st.e) };
    return out;
  }

  function computeSweep() {
    var st = stim(), NE = SW_NE, NK = SW_NK, eccs = [], profs = [], i, k;
    for (i = 0; i < NE; i++) eccs.push(axisInv((i + 0.5) / NE));
    for (k = 0; k < NK; k++) profs.push(model.sfProfile(1, Math.pow(2, LFD0 + k * SW_DLF), st.bw));
    var out = { NE: NE, NK: NK, eccs: eccs, c50: {}, rmax: {}, resp: {} };
    MODELS.forEach(function (m) {
      var c50 = new Float64Array(NE * NK), rmax = new Float64Array(NE * NK), resp = new Float64Array(NE * NK);
      for (var i = 0; i < NE; i++) {
        var col = model.probeColumn(m, eccs[i], st.size);
        for (var k = 0; k < NK; k++) {
          var u = model.units(col, profs[k]), r = model.crf(u, CS);
          c50[i * NK + k] = r.fit.c50; rmax[i * NK + k] = r.fit.rmax; resp[i * NK + k] = model.pooledAt(u, st.c);
        }
      }
      out.c50[m] = c50; out.rmax[m] = rmax; out.resp[m] = resp;
    });
    return out;
  }
  function sweepEffect(m) {
    var q = S.measure, b = sweep[q].none, v = sweep[q][m], g = new Float64Array(b.length);
    for (var j = 0; j < g.length; j++) { var e = effect(q, b[j], v[j]); g[j] = isFinite(e) ? e : 0; }
    return g;
  }
  function sweepPeaks(g) {
    var NE = sweep.NE, NK = sweep.NK, out = [];
    for (var i = 0; i < NE; i++) {
      var best = -Infinity, kb = -1;
      for (var k = 0; k < NK; k++) if (g[i * NK + k] > best) { best = g[i * NK + k]; kb = k; }
      if (best < 0.25 || kb <= 0 || kb >= NK - 1) { out.push(NaN); continue; }
      var y0 = g[i * NK + kb - 1], y1 = best, y2 = g[i * NK + kb + 1], den = y0 - 2 * y1 + y2;
      var off = den < 0 ? 0.5 * (y0 - y2) / den : 0;
      out.push(Math.pow(2, LFD0 + (kb + off) * SW_DLF));
    }
    return out;
  }

  // ---------- colour ----------
  var T = null;
  function hexToLin(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [0, 2, 4].map(function (o) {
      var c = parseInt(h.substr(o, 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
  }
  function linToLab(c) {
    var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
    var m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
    var s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function labToRgb(L) {
    var l = Math.pow(L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2], 3);
    var m = Math.pow(L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2], 3);
    var s = Math.pow(L[0] - 0.0894841775 * L[1] - 1.2914855480 * L[2], 3);
    var lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    return lin.map(function (c) {
      c = Math.max(0, Math.min(1, c));
      return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
    });
  }
  function makeLUT(stops) {
    var labs = stops.map(function (h) { return linToLab(hexToLin(h)); }), lut = new Uint8ClampedArray(256 * 3);
    for (var j = 0; j < 256; j++) {
      var t = j / 255 * (labs.length - 1), a = Math.min(labs.length - 2, Math.floor(t)), f = t - a;
      var rgb = labToRgb([0, 1, 2].map(function (q) { return labs[a][q] + f * (labs[a + 1][q] - labs[a][q]); }));
      lut[j * 3] = rgb[0]; lut[j * 3 + 1] = rgb[1]; lut[j * 3 + 2] = rgb[2];
    }
    return lut;
  }
  function tokens() {
    if (T) return T;
    var cs = getComputedStyle(document.documentElement), t = {};
    ['seq-0', 'seq-1', 'div-neg', 'div-mid', 'div-pos'].forEach(function (k) { t[k] = cs.getPropertyValue('--' + k).trim(); });
    t.seq = makeLUT([t['seq-0'], t['seq-1']]);
    t.div = makeLUT([t['div-neg'], t['div-mid'], t['div-pos']]);
    T = t; return T;
  }

  // ---------- tooltip ----------
  var tip = null;
  function showTip(x, y, title, rows) {
    tip.textContent = '';
    var tt = document.createElement('div'); tt.className = 'tt'; tt.textContent = title; tip.appendChild(tt);
    rows.forEach(function (r) {
      var row = document.createElement('div'); row.className = 'tr';
      var nm = document.createElement('span'); nm.className = 'nm';
      var key = document.createElement('i'); key.className = 'key'; key.style.setProperty('--k', r.color);
      nm.appendChild(key); nm.appendChild(document.createTextNode(r.label));
      var b = document.createElement('b'); b.textContent = r.value;
      row.appendChild(nm); row.appendChild(b); tip.appendChild(row);
    });
    tip.classList.add('on');
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = x + 16, top = y + 16;
    if (left + w > window.innerWidth - 8) left = x - w - 16;
    if (top + h > window.innerHeight - 8) top = y - h - 16;
    tip.style.left = Math.max(8, left) + 'px'; tip.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() { tip.classList.remove('on'); }

  // ---------- line plots ----------
  function sLin(a, b) { return { u: function (v) { return (v - a) / (b - a); } }; }
  function sLog(a, b) { var la = Math.log(a), lb = Math.log(b); return { u: function (v) { return (Math.log(v) - la) / (lb - la); } }; }
  function niceAxis(lo, hi, n) {
    if (!(hi > lo)) { hi = lo + 1; }
    var raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), nr = raw / mag;
    var step = (nr < 1.5 ? 1 : nr < 3 ? 2 : nr < 7 ? 5 : 10) * mag;
    var a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, ticks = [];
    for (var v = a; v <= b + step * 1e-6; v += step) ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    var d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return { min: a, max: b, ticks: ticks, dec: d };
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function drawPlot(host, cfg) {
    var W = Math.max(280, Math.round(host.clientWidth)), H = cfg.height || 256;
    var m = { l: 50, r: 18, t: 16, b: 40 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var X = cfg.x, Y = cfg.y;
    function px(v) { return m.l + pw * X.s.u(v); }
    function py(v) { return m.t + ph * (1 - Y.s.u(v)); }
    var s = [], cid = 'clip-' + host.id;
    s.push('<defs><clipPath id="' + cid + '"><rect x="' + m.l + '" y="' + (m.t - 6) + '" width="' + pw + '" height="' + (ph + 6) + '"/></clipPath></defs>');
    Y.ticks.forEach(function (t) {
      var y = py(t).toFixed(1);
      s.push('<line x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + y + '" y2="' + y + '" stroke="var(--grid)"/>');
      s.push('<text x="' + (m.l - 8) + '" y="' + (+y + 3.5) + '" text-anchor="end">' + esc(Y.fmt(t)) + '</text>');
    });
    X.ticks.forEach(function (t) {
      var x = px(t).toFixed(1);
      s.push('<line x1="' + x + '" x2="' + x + '" y1="' + (m.t + ph) + '" y2="' + (m.t + ph + 4) + '" stroke="var(--axis)"/>');
      s.push('<text x="' + x + '" y="' + (m.t + ph + 16) + '" text-anchor="middle">' + esc(X.fmt(t)) + '</text>');
    });
    s.push('<line x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + (m.t + ph) + '" y2="' + (m.t + ph) + '" stroke="var(--axis)"/>');
    if (cfg.zero) { var yz = py(0).toFixed(1); s.push('<line x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + yz + '" y2="' + yz + '" stroke="var(--axis)"/>'); }
    s.push('<text class="axis-title" x="' + (m.l + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(X.title) + '</text>');
    s.push('<text class="axis-title" transform="translate(13 ' + (m.t + ph / 2) + ') rotate(-90)" text-anchor="middle">' + esc(Y.title) + '</text>');

    (cfg.vlines || []).forEach(function (v) {
      var x = px(v.x);
      if (!(x >= m.l - 0.5 && x <= m.l + pw + 0.5)) return;
      s.push('<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (m.t + (v.row || 0) * 13 + 4) + '" y2="' + (m.t + ph) + '" stroke="var(--muted)" stroke-dasharray="3 3"/>');
      var anchor = x > m.l + pw - 70 ? 'end' : 'start';
      s.push('<text class="anno" x="' + (x + (anchor === 'end' ? -5 : 5)).toFixed(1) + '" y="' + (m.t + 9 + (v.row || 0) * 13) + '" text-anchor="' + anchor + '">' + esc(v.label) + '</text>');
    });
    s.push('<g clip-path="url(#' + cid + ')">');
    (cfg.drops || []).forEach(function (d) {
      if (!isFinite(d.x) || !isFinite(d.y)) return;
      s.push('<line x1="' + px(d.x).toFixed(1) + '" x2="' + px(d.x).toFixed(1) + '" y1="' + py(d.y).toFixed(1) + '" y2="' + (m.t + ph) + '" stroke="' + d.color + '" stroke-width="1"/>');
    });
    cfg.series.forEach(function (se) {
      var d = '', pen = false;
      se.pts.forEach(function (p) {
        if (!isFinite(p[0]) || !isFinite(p[1])) { pen = false; return; }
        d += (pen ? 'L' : 'M') + px(p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1); pen = true;
      });
      s.push('<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="' + (se.width || 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (se.dash ? ' stroke-dasharray="' + se.dash + '"' : '') + '/>');
    });
    s.push('</g>');
    (cfg.points || []).forEach(function (p) {
      if (!isFinite(p.x) || !isFinite(p.y)) return;
      var cx = px(p.x), cy = py(p.y);
      if (cx < m.l - 1 || cx > m.l + pw + 1) return;
      if (p.ring) s.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (p.r || 5) + '" fill="none" stroke="var(--surface)" stroke-width="4.5"/><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (p.r || 5) + '" fill="none" stroke="var(--ink)" stroke-width="1.6"/>');
      else s.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (p.r || 4) + '" fill="' + p.color + '" stroke="var(--surface)" stroke-width="2"/>');
    });
    (cfg.labels || []).forEach(function (l) {
      if (!isFinite(l.x) || !isFinite(l.y)) return;
      s.push('<text class="' + (l.cls || 'dlabel') + '" x="' + (px(l.x) + (l.dx || 0)).toFixed(1) + '" y="' + (py(l.y) + (l.dy || 0)).toFixed(1) + '" text-anchor="' + (l.anchor || 'middle') + '">' + esc(l.text) + '</text>');
    });
    s.push('<g class="xh" visibility="hidden"><line y1="' + m.t + '" y2="' + (m.t + ph) + '" stroke="var(--muted)"/>');
    cfg.series.forEach(function (se) { if (se.hover !== false) s.push('<circle r="4.5" fill="' + se.color + '" stroke="var(--surface)" stroke-width="2"/>'); });
    s.push('</g>');
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || '') + '">' + s.join('') + '</svg>';
    host._plot = { cfg: cfg, m: m, pw: pw, ph: ph, W: W, px: px, py: py };
    if (!host._bound) {
      host._bound = true;
      host.addEventListener('pointermove', function (ev) { plotHover(host, ev); });
      host.addEventListener('pointerleave', function () { var g = host.querySelector('.xh'); if (g) g.setAttribute('visibility', 'hidden'); hideTip(); });
    }
    return host._plot;
  }
  function plotHover(host, ev) {
    var P = host._plot; if (!P || !P.cfg.hover) return;
    var r = host.getBoundingClientRect(), x = (ev.clientX - r.left) * P.W / r.width;
    var g = host.querySelector('.xh'), hv = P.cfg.hover;
    if (x < P.m.l - 4 || x > P.m.l + P.pw + 4) { g.setAttribute('visibility', 'hidden'); hideTip(); return; }
    var best = 0, bd = Infinity;
    for (var j = 0; j < hv.xs.length; j++) { var d = Math.abs(P.px(hv.xs[j]) - x); if (d < bd) { bd = d; best = j; } }
    var X = P.px(hv.xs[best]).toFixed(1), line = g.firstChild, dots = g.querySelectorAll('circle'), q = 0;
    line.setAttribute('x1', X); line.setAttribute('x2', X);
    P.cfg.series.forEach(function (se) {
      if (se.hover === false) return;
      var c = dots[q++], p = se.pts[best];
      if (p && isFinite(p[1])) { c.setAttribute('cx', X); c.setAttribute('cy', P.py(p[1]).toFixed(1)); c.setAttribute('visibility', 'inherit'); }
      else c.setAttribute('visibility', 'hidden');
    });
    g.setAttribute('visibility', 'visible');
    showTip(ev.clientX, ev.clientY, hv.title(best), hv.rows(best));
  }

  var SFAX = { s: sLog(0.125, 16), ticks: SF_TICKS, fmt: function (v) { return String(v); } };
  function eccAxis(title) {
    return { s: { u: axisU }, ticks: eccTicks(), fmt: function (v) { return String(v); }, title: title || (S.axis === 'cortex' ? 'Eccentricity (deg), spaced by cortical distance' : 'Eccentricity (deg)') };
  }

  // ---------- fast renders ----------
  function renderTiles() {
    var q = S.measure, st = fast.st, base = fast.res.none[q];
    $('t-stim-what').textContent = 'Gain ridge sits at ' + fSF(V.fAtt) + ' cpd at every eccentricity, including the probe’s ' + fDeg(st.e) + '.';
    $('t-cort-what').textContent = 'Gain ridge is rescaled to ' + fSF(fast.ridge.cort) + ' cpd at the probe’s ' + fDeg(st.e) + (S.cortRule === 'mag' ? ' (constant cycles per mm of cortex).' : ' (same place relative to the local SF preference).');
    ['stim', 'cort'].forEach(function (m) {
      var v = fast.res[m][q], e = effect(q, base, v), el = $('t-' + m + '-val');
      el.textContent = (q === 'c50' ? plain(e, 1) : signed(e, 1)) + '%';
      var sm = document.createElement('small'); sm.textContent = MEAS[q].tile; el.appendChild(sm);
      var fb = fast.res.none.fit, fm = fast.res[m].fit;
      $('t-' + m + '-sub').textContent = q === 'c50' ? 'c50 ' + fC50(base) + ' → ' + fC50(v) + ' · Rmax ' + signed(100 * (fm.rmax / fb.rmax - 1), 1) + '%'
        : q === 'rmax' ? 'Rmax ' + base.toFixed(3) + ' → ' + v.toFixed(3) + ' · c50 ' + signed(100 * (fm.c50 / fb.c50 - 1), 1) + '%'
        : 'Response at ' + fPct(st.c) + ' contrast: ' + base.toFixed(3) + ' → ' + v.toFixed(3);
    });
    var best = -1, bd = 0, floor = 0, j;
    var ref = q === 'resp' ? fast.tun.none.resp : fast.tun.none.rmax;
    for (j = 0; j < ref.length; j++) if (ref[j] > floor) floor = ref[j];
    floor *= 0.1;
    for (j = 0; j < TLF.length; j++) {
      if (!(ref[j] >= floor)) continue;
      var d = effect(q, fast.tun.none[q][j], fast.tun.stim[q][j]) - effect(q, fast.tun.none[q][j], fast.tun.cort[q][j]);
      if (isFinite(d) && Math.abs(d) > Math.abs(bd)) { bd = d; best = j; }
    }
    var sep = Math.abs(Math.log2(fast.ridge.stim / fast.ridge.cort));
    $('t-diag-what').textContent = 'Probe SF at ' + fDeg(st.e) + ' where the two models disagree most on the ' + MEAS[q].short + '.';
    if (best < 0 || Math.abs(bd) < 0.5) {
      $('t-diag-val').textContent = '–';
      $('t-diag-sub').textContent = 'The two models make the same prediction at this eccentricity.';
    } else {
      var el2 = $('t-diag-val'); el2.textContent = fSF(Math.pow(2, TLF[best]));
      var sm2 = document.createElement('small'); sm2.textContent = 'cpd'; el2.appendChild(sm2);
      $('t-diag-sub').textContent = (bd > 0 ? 'Stimulus-based' : 'Cortical-based') + ' is larger by ' + Math.abs(bd).toFixed(1) + ' points. Ridges sit ' + sep.toFixed(2) + ' octaves apart here.';
    }
  }

  function renderCRF() {
    var st = fast.st, ymax = 0, series = [], points = [], drops = [];
    MODELS.forEach(function (m) {
      var fit = fast.res[m].fit;
      var pts = CFINE.map(function (c) { return [c, F.nakaRushton(fit, c)]; });
      pts.forEach(function (p) { if (p[1] > ymax) ymax = p[1]; });
      series.push({ color: COLOR[m], pts: pts, name: NAMES[m] });
    });
    // draw the attended curves over the baseline, and their points last
    MODELS.forEach(function (m) {
      CS.forEach(function (c, j) { points.push({ x: c, y: fast.res[m].ys[j], color: COLOR[m], r: 3.4 }); });
      var fit = fast.res[m].fit;
      if (fit.c50 <= 1) drops.push({ x: fit.c50, y: fit.rmax / 2, color: COLOR[m] });
    });
    var ya = niceAxis(0, ymax * 1.06 || 1, 4);
    drawPlot($('plot-crf'), {
      aria: 'Contrast response functions at the probe',
      x: { s: sLog(0.0085, 1.08), ticks: [0.01, 0.03, 0.1, 0.3, 1], fmt: function (v) { return String(Math.round(v * 100)); }, title: 'Probe contrast (%)' },
      y: { s: sLin(ya.min, ya.max), ticks: ya.ticks, fmt: function (v) { return v.toFixed(ya.dec); }, title: 'Pooled response (a.u.)' },
      series: series, points: points, drops: drops,
      vlines: [{ x: st.c, label: 'probe contrast' }],
      hover: {
        xs: CFINE,
        title: function (j) { return 'Contrast ' + fPct(CFINE[j]); },
        rows: function (j) { return series.map(function (se) { return { color: se.color, label: se.name, value: se.pts[j][1].toFixed(3) }; }); }
      }
    });
    $('crf-sub').textContent = 'Pooled response at ' + fDeg(st.e) + ' to a ' + fSF(st.f) + ' cpd ' + (st.bw > 0 ? 'band-pass probe' : 'grating') + '. Points are the simulated measurements, curves the Naka–Rushton fits, drop lines the estimated c50.';
    var tb = $('est-body'); tb.textContent = '';
    var b = fast.res.none.fit;
    MODELS.forEach(function (m) {
      var f = fast.res[m].fit, tr = document.createElement('tr');
      function td(txt) { var c = document.createElement('td'); c.textContent = txt; tr.appendChild(c); return c; }
      var first = document.createElement('td'), key = document.createElement('i');
      key.className = 'key'; key.style.setProperty('--k', COLOR[m]);
      first.appendChild(key); first.appendChild(document.createTextNode(NAMES[m])); tr.appendChild(first);
      td(fC50(f.c50));
      td(m === 'none' ? '–' : signed(100 * (f.c50 / b.c50 - 1), 1) + '%');
      td(f.rmax.toFixed(3));
      td(m === 'none' ? '–' : signed(100 * (f.rmax / b.rmax - 1), 1) + '%');
      td(f.n.toFixed(2));
      tb.appendChild(tr);
    });
  }

  function tuneSeries(m) {
    var q = S.measure;
    var ref = q === 'resp' ? fast.tun.none.resp : fast.tun.none.rmax, floor = 0;
    ref.forEach(function (v) { if (v > floor) floor = v; });
    floor *= 0.01;
    return TLF.map(function (lf, j) {
      var e = ref[j] >= floor ? effect(q, fast.tun.none[q][j], fast.tun[m][q][j]) : NaN;
      return [Math.pow(2, lf), e];
    });
  }
  function renderTune() {
    var q = S.measure, st = fast.st, lo = 0, hi = 0, series = [], labels = [], peaks = {};
    ['stim', 'cort'].forEach(function (m) {
      var pts = tuneSeries(m), pk = null;
      pts.forEach(function (p) { if (!isFinite(p[1])) return; if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; if (!pk || p[1] > pk[1]) pk = p; });
      series.push({ color: COLOR[m], pts: pts, name: NAMES[m] });
      peaks[m] = pk;
    });
    if (hi - lo < 1) { hi = Math.max(hi, 1); }
    var ya = niceAxis(lo, hi * 1.18, 5), X = SFAX;
    var host = $('plot-tune'), pwA = Math.max(280, host.clientWidth) - 68;
    if (peaks.stim && peaks.cort && peaks.stim[1] > 0.5 && peaks.cort[1] > 0.5 && Math.abs(Math.log2(peaks.stim[0] / peaks.cort[0])) > 0.9) {
      // label each curve on its outer flank, at half height, where the other curve is out of the way
      var right = peaks.stim[0] > peaks.cort[0] ? 0 : 1;
      [right, 1 - right].forEach(function (si, side) {
        var pts = series[si].pts, pk = peaks[si === 0 ? 'stim' : 'cort'], hit = null, j;
        if (side === 0) { for (j = pts.length - 1; j >= 0; j--) if (pts[j][1] >= 0.5 * pk[1]) { hit = pts[j]; break; } }
        else { for (j = 0; j < pts.length; j++) if (pts[j][1] >= 0.5 * pk[1]) { hit = pts[j]; break; } }
        if (!hit) return;
        var ux = SFAX.s.u(hit[0]) * pwA;
        if (side === 0 ? ux + 100 > pwA : ux - 100 < 0) return;
        labels.push({ x: hit[0], y: hit[1], dx: side === 0 ? 9 : -9, dy: 4, anchor: side === 0 ? 'start' : 'end', text: series[si].name });
      });
    }
    var H = 256;
    if (window.innerWidth > 760) {
      var crfCard = $('card-crf'), th = $('card-tune').querySelector('.chart-head').offsetHeight;
      H = Math.max(256, Math.min(460, crfCard.querySelector('.chart-head').offsetHeight + $('plot-crf').offsetHeight + crfCard.querySelector('table').offsetHeight + 8 - th));
    }
    var vl = [{ x: V.fAtt, label: 'attended SF', row: 0 }];
    if (Math.abs(Math.log2(fast.ridge.cort / V.fAtt)) > 0.2) vl.push({ x: fast.ridge.cort, label: 'rescaled SF', row: 0 });
    var base = fast.res.none[q];
    drawPlot($('plot-tune'), {
      height: H,
      aria: 'Attention effect as a function of probe spatial frequency',
      x: { s: X.s, ticks: X.ticks, fmt: X.fmt, title: 'Probe spatial frequency (cpd)' },
      y: { s: sLin(ya.min, ya.max), ticks: ya.ticks, fmt: function (v) { return plain(v, ya.dec); }, title: MEAS[q].short + ' (%)' },
      zero: true, series: series, vlines: vl, labels: labels,
      points: ['stim', 'cort'].map(function (m) { return { x: st.f, y: effect(q, base, fast.res[m][q]), color: COLOR[m], r: 4.5 }; }),
      hover: {
        xs: TLF.map(function (lf) { return Math.pow(2, lf); }),
        title: function (j) { return 'Probe at ' + fSF(Math.pow(2, TLF[j])) + ' cpd'; },
        rows: function (j) { return series.map(function (se) { return { color: se.color, label: se.name, value: isFinite(se.pts[j][1]) ? signed(se.pts[j][1], 1) + '%' : '–' }; }); }
      }
    });
    $('tune-sub').textContent = MEAS[q].long + ' for a probe at ' + fDeg(st.e) + '. Dots mark the current probe.';
  }

  function renderPSFT() {
    var st = fast.st, ymax = 0, series = [];
    MODELS.forEach(function (m) {
      var pts = TLF.map(function (lf, j) { return [Math.pow(2, lf), fast.tun[m].resp[j]]; });
      pts.forEach(function (p) { if (p[1] > ymax) ymax = p[1]; });
      series.push({ color: COLOR[m], pts: pts, name: NAMES[m] });
    });
    var ya = niceAxis(0, ymax * 1.06 || 1, 4);
    drawPlot($('plot-psft'), {
      aria: 'Pooled response as a function of probe spatial frequency',
      x: { s: SFAX.s, ticks: SFAX.ticks, fmt: SFAX.fmt, title: 'Probe spatial frequency (cpd)' },
      y: { s: sLin(ya.min, ya.max), ticks: ya.ticks, fmt: function (v) { return v.toFixed(ya.dec); }, title: 'Pooled response (a.u.)' },
      series: series, vlines: [{ x: V.fAtt, label: 'attended SF' }],
      hover: {
        xs: TLF.map(function (lf) { return Math.pow(2, lf); }),
        title: function (j) { return 'Probe at ' + fSF(Math.pow(2, TLF[j])) + ' cpd'; },
        rows: function (j) { return series.map(function (se) { return { color: se.color, label: se.name, value: se.pts[j][1].toFixed(3) }; }); }
      }
    });
    $('psft-sub').textContent = 'Pooled response at ' + fDeg(st.e) + ' to probes of each SF at ' + fPct(st.c) + ' contrast.';
  }

  // ---------- sweep renders ----------
  var peakData = null;
  function renderPeak() {
    if (!sweep) return;
    var q = S.measure, series = [], labels = [];
    peakData = { ecc: sweep.eccs, stim: sweepPeaks(sweepEffect('stim')), cort: sweepPeaks(sweepEffect('cort')) };
    var pref = [], uu;
    for (uu = 0; uu <= 60; uu++) { var e = axisInv(uu / 60); pref.push([e, model.prefSF(e)]); }
    series.push({ color: COLOR.none, pts: pref, width: 1.5, dash: '2 4', hover: false });
    ['stim', 'cort'].forEach(function (m) {
      var pts = sweep.eccs.map(function (e, j) { return [e, peakData[m][j]]; });
      series.push({ color: COLOR[m], pts: pts, name: NAMES[m] });
    });
    var ends = {};
    ['stim', 'cort'].forEach(function (m, jm) {
      var pts = series[jm + 1].pts;
      for (var j = pts.length - 1; j >= 0; j--) if (isFinite(pts[j][1]) && pts[j][1] > 0.125 && pts[j][1] < 16) { ends[m] = pts[j]; break; }
    });
    if (ends.stim && ends.cort && Math.abs(Math.log2(ends.stim[1] / ends.cort[1])) > 0.6) {
      ['stim', 'cort'].forEach(function (m) { labels.push({ x: ends[m][0], y: ends[m][1], dy: -8, dx: 0, anchor: 'end', text: NAMES[m] }); });
    }
    drawPlot($('plot-peak'), {
      aria: 'Spatial frequency of the largest attention effect by eccentricity',
      x: eccAxis(),
      y: { s: SFAX.s, ticks: SFAX.ticks, fmt: SFAX.fmt, title: 'Probe SF with the largest effect (cpd)' },
      series: series, labels: labels,
      vlines: [{ x: V.pe, label: 'probe' }],
      points: [{ x: V.eAtt, y: V.fAtt, ring: true, r: 5.5 }],
      hover: {
        xs: sweep.eccs,
        title: function (j) { return 'Eccentricity ' + sweep.eccs[j].toFixed(2) + '°'; },
        rows: function (j) {
          return ['stim', 'cort'].map(function (m) { return { color: COLOR[m], label: NAMES[m], value: isFinite(peakData[m][j]) ? fSF(peakData[m][j]) + ' cpd' : 'off scale' }; })
            .concat([{ color: COLOR.none, label: 'Preferred SF', value: fSF(model.prefSF(sweep.eccs[j])) + ' cpd' }]);
        }
      }
    });
    $('peak-sub').textContent = 'Probe SF giving the largest ' + MEAS[q].short + ' at each eccentricity. The ring is the attended grating.';
  }

  // ---------- maps ----------
  var mapState = null;
  function gridSample(arr, e, lf) {
    var xi = model.xOf(e) / model.dx, kf = (lf - F.LF_MIN) / F.DLF, NX = model.NX, NF = model.NF;
    xi = Math.max(0, Math.min(NX - 1.001, xi)); kf = Math.max(0, Math.min(NF - 1.001, kf));
    var i0 = Math.floor(xi), k0 = Math.floor(kf), fx = xi - i0, fk = kf - k0;
    return (1 - fx) * ((1 - fk) * arr[i0 * NF + k0] + fk * arr[i0 * NF + k0 + 1]) + fx * ((1 - fk) * arr[(i0 + 1) * NF + k0] + fk * arr[(i0 + 1) * NF + k0 + 1]);
  }
  function sweepSample(g, u, lf) {
    var NE = sweep.NE, NK = sweep.NK;
    var ci = Math.max(0, Math.min(NE - 1.001, u * NE - 0.5)), kf = Math.max(0, Math.min(NK - 1.001, (lf - LFD0) / SW_DLF));
    var i0 = Math.floor(ci), k0 = Math.floor(kf), fx = ci - i0, fk = kf - k0;
    return (1 - fx) * ((1 - fk) * g[i0 * NK + k0] + fk * g[i0 * NK + k0 + 1]) + fx * ((1 - fk) * g[(i0 + 1) * NK + k0] + fk * g[(i0 + 1) * NK + k0 + 1]);
  }

  function glyph(kind) {
    var a = '<svg class="glyph" viewBox="0 0 16 10" aria-hidden="true">';
    if (kind === 'ridge') a += '<line x1="0" x2="16" y1="5" y2="5" stroke="var(--ink)" stroke-width="1.8"/>';
    if (kind === 'pref') a += '<line x1="0" x2="16" y1="5" y2="5" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="2 3"/>';
    if (kind === 'att') a += '<circle cx="8" cy="5" r="3.6" fill="none" stroke="var(--ink)" stroke-width="1.5"/>';
    if (kind === 'probe') a += '<path d="M8 0.8 L12.2 5 L8 9.2 L3.8 5 Z" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.4"/>';
    if (kind === 'veil') a += '<rect x="1" y="1" width="14" height="8" fill="var(--muted)" opacity="0.35"/>';
    return a + '</svg>';
  }

  function renderMaps() {
    if (!model || !fast) return;
    var view = S.view, tk = tokens(), st = fast.st, samp = {}, lut, vmin, vmax, yTitle, fmt, cbT, cbLo, cbHi, veil = null;
    if (view === 'sweep' && !sweep) return;
    if (view === 'field') {
      ['stim', 'cort'].forEach(function (m) { var A = model.A[m]; samp[m] = function (e, lf) { return gridSample(A, e, lf); }; });
      lut = tk.seq; vmin = 1; vmax = Math.max(V.gain, 1.02); yTitle = 'Preferred SF of the unit (cpd)';
      fmt = function (v) { return v.toFixed(2) + '×'; };
      cbT = 'Attentional gain'; cbLo = '1.0×'; cbHi = vmax.toFixed(2) + '×';
      $('maps-sub').textContent = 'Gain each model applies to every unit, by receptive-field eccentricity and preferred SF. This is the only thing that differs between them.';
    } else if (view === 'resp') {
      var mx = 1e-9;
      ['stim', 'cort'].forEach(function (m) {
        var R = model.image(m, st).R;
        for (var j = 0; j < R.length; j++) if (R[j] > mx) mx = R[j];
        samp[m] = function (e, lf) { return gridSample(R, e, lf); };
      });
      lut = tk.seq; vmin = 0; vmax = mx; yTitle = 'Preferred SF of the unit (cpd)';
      fmt = function (v) { return v.toFixed(3); };
      cbT = 'Unit response (a.u.)'; cbLo = '0'; cbHi = mx.toFixed(2);
      $('maps-sub').textContent = 'Normalized response of every unit to the probe (' + fSF(st.f) + ' cpd at ' + fDeg(st.e) + ', ' + fPct(st.c) + ' contrast) with each attention field applied.';
    } else {
      var q = S.measure, mxe = 1;
      ['stim', 'cort'].forEach(function (m) {
        var g = sweepEffect(m);
        for (var j = 0; j < g.length; j++) if (Math.abs(g[j]) > mxe) mxe = Math.abs(g[j]);
        samp[m] = function (e, lf, u) { return sweepSample(g, u, lf); };
      });
      lut = tk.div; vmin = -mxe; vmax = mxe; yTitle = 'Probe SF (cpd)';
      fmt = function (v) { return signed(v, 1) + '%'; };
      cbT = MEAS[q].short + ' (%)'; cbLo = '−' + mxe.toFixed(0); cbHi = '+' + mxe.toFixed(0);
      $('maps-sub').textContent = 'Each point is a separate experiment: place the probe at that eccentricity and SF, estimate its contrast response with and without attention, and plot the ' + MEAS[q].short + '.';
      veil = q === 'resp' ? sweep.resp.none : sweep.rmax.none;
    }
    mapState = { samp: samp, fmt: fmt, view: view };
    ['stim', 'cort'].forEach(function (m) { drawMap($('map-' + m), m, samp[m], lut, vmin, vmax, yTitle, veil); });
    $('cb-title').textContent = cbT; $('cb-lo').textContent = cbLo; $('cb-hi').textContent = cbHi;
    var cb = $('cb-canvas'), ctx = cb.getContext('2d'), img = ctx.createImageData(200, 10);
    for (var y = 0; y < 10; y++) for (var x = 0; x < 200; x++) {
      var j = Math.round(x / 199 * 255), o = (y * 200 + x) * 4;
      img.data[o] = lut[j * 3]; img.data[o + 1] = lut[j * 3 + 1]; img.data[o + 2] = lut[j * 3 + 2]; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    $('map-legend').innerHTML = '<span>' + glyph('ridge') + 'Gain ridge</span><span>' + glyph('pref') + 'Preferred SF p(e)</span><span>' + glyph('att') + 'Attended grating</span><span>' + glyph('probe') + 'Probe</span>' + (veil ? '<span>' + glyph('veil') + 'Too little response to measure</span>' : '');
  }

  function drawMap(host, mdl, sample, lut, vmin, vmax, yTitle, veil) {
    var W = Math.max(260, Math.round(host.clientWidth)), H = Math.round(Math.max(236, Math.min(330, W * 0.6)));
    var m = { l: 46, r: 10, t: 8, b: 40 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var GW = 200, GH = 120, cv = host.querySelector('canvas'), svg = host.querySelector('svg');
    cv.width = GW; cv.height = GH;
    cv.style.left = (m.l / W * 100) + '%'; cv.style.top = (m.t / H * 100) + '%';
    cv.style.width = (pw / W * 100) + '%'; cv.style.height = (ph / H * 100) + '%';
    var ctx = cv.getContext('2d'), img = ctx.createImageData(GW, GH), d = img.data, span = vmax - vmin;
    for (var gx = 0; gx < GW; gx++) {
      var u = (gx + 0.5) / GW, e = axisInv(u);
      for (var gy = 0; gy < GH; gy++) {
        var lf = LFD1 - (gy + 0.5) / GH * (LFD1 - LFD0);
        var t = (sample(e, lf, u) - vmin) / span;
        var j = Math.max(0, Math.min(255, Math.round(t * 255))), o = (gy * GW + gx) * 4;
        d[o] = lut[j * 3]; d[o + 1] = lut[j * 3 + 1]; d[o + 2] = lut[j * 3 + 2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    function X(u) { return m.l + pw * u; }
    function Y(lf) { return m.t + ph * (LFD1 - lf) / (LFD1 - LFD0); }
    var s = [], cid = 'clip-' + host.id;
    s.push('<defs><clipPath id="' + cid + '"><rect x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '"/></clipPath></defs>');
    s.push('<g clip-path="url(#' + cid + ')">');
    if (veil) {
      var NE = sweep.NE, NK = sweep.NK, mx = 0, jj;
      for (jj = 0; jj < veil.length; jj++) if (veil[jj] > mx) mx = veil[jj];
      var thr = 0.1 * mx, top = [], bot = [];
      for (var ie = 0; ie < NE; ie++) {
        var kHi = -1, kLo = -1;
        for (var k = 0; k < NK; k++) if (veil[ie * NK + k] >= thr) { if (kLo < 0) kLo = k; kHi = k; }
        var lfHi, lfLo;
        if (kHi < 0) { lfHi = lfLo = (LFD0 + LFD1) / 2; }
        else {
          var a = veil[ie * NK + kHi], b = kHi < NK - 1 ? veil[ie * NK + kHi + 1] : a;
          lfHi = kHi >= NK - 1 ? LFD1 + 1 : LFD0 + (kHi + (a - thr) / Math.max(a - b, 1e-12)) * SW_DLF;
          var a2 = veil[ie * NK + kLo], b2 = kLo > 0 ? veil[ie * NK + kLo - 1] : a2;
          lfLo = kLo <= 0 ? LFD0 - 1 : LFD0 + (kLo - (a2 - thr) / Math.max(a2 - b2, 1e-12)) * SW_DLF;
        }
        top.push([(ie + 0.5) / NE, lfHi]); bot.push([(ie + 0.5) / NE, lfLo]);
      }
      [[top, m.t - 2], [bot, m.t + ph + 2]].forEach(function (pair) {
        var pts = pair[0], edge = pair[1];
        var dd = 'M' + X(0) + ',' + edge + 'L' + X(0) + ',' + Y(pts[0][1]).toFixed(1);
        pts.forEach(function (p) { dd += 'L' + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); });
        dd += 'L' + X(1) + ',' + Y(pts[pts.length - 1][1]).toFixed(1) + 'L' + X(1) + ',' + edge + 'Z';
        s.push('<path d="' + dd + '" fill="var(--surface)" opacity="0.68"/>');
      });
    }
    var dp = '', dr = '', q;
    for (q = 0; q <= 120; q++) {
      var uu = q / 120, ee = axisInv(uu);
      dp += (q ? 'L' : 'M') + X(uu).toFixed(1) + ',' + Y(Math.log2(model.prefSF(ee))).toFixed(1);
      var lr = Math.max(-12, Math.min(14, Math.log2(model.ridgeSF(mdl, ee))));
      dr += (q ? 'L' : 'M') + X(uu).toFixed(1) + ',' + Y(lr).toFixed(1);
    }
    s.push('<path d="' + dp + '" fill="none" stroke="var(--surface)" stroke-width="3" opacity="0.7"/><path d="' + dp + '" fill="none" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="2 4"/>');
    s.push('<path d="' + dr + '" fill="none" stroke="var(--surface)" stroke-width="4.5" opacity="0.8"/><path d="' + dr + '" fill="none" stroke="var(--ink)" stroke-width="1.8"/>');
    var ax = X(axisU(V.eAtt)), ay = Y(Math.log2(V.fAtt)), bx = X(axisU(V.pe)), by = Y(Math.log2(V.pf));
    s.push('<circle cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="6" fill="none" stroke="var(--surface)" stroke-width="4.5"/><circle cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="6" fill="none" stroke="var(--ink)" stroke-width="1.6"/>');
    s.push('<path d="M' + bx.toFixed(1) + ',' + (by - 6).toFixed(1) + 'l6,6l-6,6l-6,-6Z" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>');
    s.push('</g>');
    s.push('<rect x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="var(--axis)"/>');
    SF_TICKS.forEach(function (f) {
      if (f < 0.2) return;
      var y = Y(Math.log2(f));
      s.push('<line x1="' + (m.l - 4) + '" x2="' + m.l + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="var(--axis)"/>');
      s.push('<text x="' + (m.l - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + f + '</text>');
    });
    eccTicks().forEach(function (e) {
      var x = X(axisU(e));
      s.push('<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (m.t + ph) + '" y2="' + (m.t + ph + 4) + '" stroke="var(--axis)"/>');
      s.push('<text x="' + x.toFixed(1) + '" y="' + (m.t + ph + 16) + '" text-anchor="middle">' + e + '</text>');
    });
    s.push('<text class="axis-title" x="' + (m.l + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + (S.axis === 'cortex' ? 'Eccentricity (deg), spaced by cortical distance' : 'Eccentricity (deg)') + '</text>');
    s.push('<text class="axis-title" transform="translate(12 ' + (m.t + ph / 2) + ') rotate(-90)" text-anchor="middle">' + yTitle + '</text>');
    s.push('<g class="xh" visibility="hidden"><line x1="' + m.l + '" x2="' + (m.l + pw) + '" stroke="var(--ink)" stroke-width="1" opacity="0.55"/><line y1="' + m.t + '" y2="' + (m.t + ph) + '" stroke="var(--ink)" stroke-width="1" opacity="0.55"/></g>');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', NAMES[mdl] + ' map over eccentricity and spatial frequency');
    svg.innerHTML = s.join('');
    host._geom = { m: m, pw: pw, ph: ph, W: W, H: H };
    if (!host._bound) {
      host._bound = true;
      host.addEventListener('pointermove', function (ev) { mapHover(host, ev); });
      host.addEventListener('pointerleave', function () {
        ['stim', 'cort'].forEach(function (k) { var g = $('map-' + k).querySelector('.xh'); if (g) g.setAttribute('visibility', 'hidden'); });
        hideTip();
      });
    }
  }
  function mapHover(host, ev) {
    var G = host._geom; if (!G || !mapState) return;
    var r = host.getBoundingClientRect(), sc = G.W / r.width;
    var x = (ev.clientX - r.left) * sc, y = (ev.clientY - r.top) * sc;
    var u = (x - G.m.l) / G.pw, v = (y - G.m.t) / G.ph;
    var on = u >= 0 && u <= 1 && v >= 0 && v <= 1;
    ['stim', 'cort'].forEach(function (k) {
      var h = $('map-' + k), g = h.querySelector('.xh'), gg = h._geom;
      if (!g || !gg) return;
      if (!on) { g.setAttribute('visibility', 'hidden'); return; }
      var lx = gg.m.l + u * gg.pw, ly = gg.m.t + v * gg.ph, ln = g.querySelectorAll('line');
      ln[0].setAttribute('y1', ly); ln[0].setAttribute('y2', ly); ln[1].setAttribute('x1', lx); ln[1].setAttribute('x2', lx);
      g.setAttribute('visibility', 'visible');
    });
    if (!on) { hideTip(); return; }
    var e = axisInv(u), lf = LFD1 - v * (LFD1 - LFD0);
    showTip(ev.clientX, ev.clientY, e.toFixed(2) + '°, ' + fSF(Math.pow(2, lf)) + ' cpd', ['stim', 'cort'].map(function (k) {
      return { color: COLOR[k], label: NAMES[k], value: mapState.fmt(mapState.samp[k](e, lf, u)) };
    }));
  }

  // ---------- data table ----------
  function buildCSV() {
    var L = [], st = fast.st, q = S.measure;
    L.push('# FBA normalization model predictions');
    L.push('# attention: gain ' + V.gain + ', attended ' + V.fAtt.toFixed(3) + ' cpd at ' + V.eAtt + ' deg, SF width ' + V.sigAf + ' oct, cortical rule ' + S.cortRule);
    L.push('# probe: ' + st.f.toFixed(3) + ' cpd at ' + st.e + ' deg, contrast ' + st.c.toFixed(4) + ', size ' + (st.size >= F.FULL_FIELD ? 'full field' : st.size + ' deg') + ', SF bandwidth ' + st.bw + ' oct');
    L.push('# model: sigma ' + V.sigma + ', n ' + V.n + ', pool ' + V.sigSf + ' oct x ' + V.sigSx + ' mm, unit tuning ' + V.sigT + ' oct, pool pref spread ' + V.sigPop + ' oct, voxel SF band ' + V.sigVox + ' oct, e2 ' + V.e2 + ', pref period ' + V.a + 'e+' + V.b);
    L.push(''); L.push('[naka_rushton_fit]'); L.push('condition,c50,rmax,n');
    MODELS.forEach(function (m) { var f = fast.res[m].fit; L.push(m + ',' + f.c50.toFixed(5) + ',' + f.rmax.toFixed(5) + ',' + f.n.toFixed(4)); });
    L.push(''); L.push('[contrast_response_at_probe]'); L.push('contrast,none,stim,cort');
    CS.forEach(function (c, j) { L.push(c.toFixed(4) + ',' + MODELS.map(function (m) { return fast.res[m].ys[j].toFixed(5); }).join(',')); });
    L.push(''); L.push('[by_probe_sf_at_probe_eccentricity]');
    L.push('sf_cpd,c50_none,c50_stim,c50_cort,rmax_none,rmax_stim,rmax_cort,resp_none,resp_stim,resp_cort');
    TLF.forEach(function (lf, j) {
      if (j % 2) return;
      var row = [Math.pow(2, lf).toFixed(4)];
      ['c50', 'rmax', 'resp'].forEach(function (k) { MODELS.forEach(function (m) { row.push(fast.tun[m][k][j].toFixed(5)); }); });
      L.push(row.join(','));
    });
    if (sweep && peakData) {
      L.push(''); L.push('[peak_sf_by_eccentricity, measure=' + q + ']');
      L.push('ecc_deg,peak_sf_stim,peak_sf_cort,ridge_sf_stim,ridge_sf_cort,preferred_sf');
      sweep.eccs.forEach(function (e, j) {
        L.push([e.toFixed(3), isFinite(peakData.stim[j]) ? peakData.stim[j].toFixed(4) : '', isFinite(peakData.cort[j]) ? peakData.cort[j].toFixed(4) : '', model.ridgeSF('stim', e).toFixed(4), model.ridgeSF('cort', e).toFixed(4), model.prefSF(e).toFixed(4)].join(','));
      });
    }
    return L.join('\n');
  }
  function refreshData() { if (!$('datapanel').hidden) $('data-text').value = buildCSV(); }

  // ---------- update loop ----------
  var raf = 0, sweepTimer = 0, lastSweepMs = 0;
  function request() { if (!raf) raf = requestAnimationFrame(update); }
  function setStale(on) {
    $('card-peak').classList.toggle('stale', on);
    $('card-maps').classList.toggle('stale', on && S.view === 'sweep');
  }
  function runSweep() {
    sweepTimer = 0;
    var t0 = performance.now();
    sweep = computeSweep();
    lastSweepMs = performance.now() - t0;
    setStale(false);
    renderPeak();
    if (S.view === 'sweep') renderMaps();
    refreshData();
  }
  function update() {
    raf = 0;
    readControls();
    model = F.create({ gain: V.gain, fAtt: V.fAtt, eAtt: V.eAtt, sigAf: V.sigAf, cortRule: S.cortRule, sigma: V.sigma, n: V.n, sigSf: V.sigSf, sigSx: V.sigSx, sigT: V.sigT, sigPop: V.sigPop, sigVox: V.sigVox, e2: V.e2, a: V.a, b: V.b });
    fast = computeFast();
    renderTiles(); renderCRF(); renderTune(); renderPSFT();
    if (S.view !== 'sweep') renderMaps();
    if (sweepTimer) { clearTimeout(sweepTimer); sweepTimer = 0; }
    if (lastSweepMs < 60) runSweep();
    else { setStale(true); sweepTimer = setTimeout(runSweep, 130); }
  }
  function renderAll() {
    if (!fast) return;
    renderTiles(); renderCRF(); renderTune(); renderPSFT(); renderPeak(); renderMaps();
  }

  function init() {
    tip = $('tip');
    buildControls();
    $('data-toggle').addEventListener('click', function () {
      var p = $('datapanel'); p.hidden = !p.hidden;
      this.setAttribute('aria-expanded', String(!p.hidden));
      this.textContent = p.hidden ? 'Data table' : 'Hide data table';
      refreshData();
    });
    $('data-copy').addEventListener('click', function () {
      var ta = $('data-text'), status = $('data-status');
      function fallback() { ta.focus(); ta.select(); status.textContent = 'Copy was blocked here. The text is selected: press Ctrl or Cmd + C.'; }
      try {
        navigator.clipboard.writeText(ta.value).then(function () { status.textContent = 'Copied.'; }, fallback);
      } catch (err) { fallback(); }
    });
    var rz = 0;
    if (window.ResizeObserver) new ResizeObserver(function () { clearTimeout(rz); rz = setTimeout(renderAll, 80); }).observe(document.querySelector('.main'));
    function themeChanged() { T = null; renderAll(); }
    new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', themeChanged);
    }
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
