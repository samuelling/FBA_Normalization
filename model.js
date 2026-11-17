/*
 * Normalization model of feature-based attention (after Reynolds & Heeger, 2009),
 * laid out over a neural image of eccentricity x preferred spatial frequency.
 *
 *   R(x, f) = A(x, f) * E(x, f)^n / ( S(x, f) + sigma^n )
 *   S       = suppressive kernel (*) [ density * A * E^n ]
 *
 * x is cortical distance (mm) along one meridian, so receptive fields and the
 * suppressive pool have a fixed size on cortex and grow with eccentricity in
 * the visual field. f is log2 spatial frequency (cpd).
 *
 * Two attention fields are compared. Both are spatially global and both pass
 * through the attended stimulus (fAtt cpd at eAtt deg):
 *   'stim'  the gain ridge sits at fAtt cpd at every eccentricity
 *   'cort'  the gain ridge is rescaled with eccentricity, either with cortical
 *           magnification M(e) (constant cycles per mm of cortex) or with the
 *           local preferred spatial frequency p(e)
 *
 * No DOM access: runs in the browser (window.FBAModel) and in node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FBAModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var E_MAX = 12;            // deg, extent of the simulated meridian
  var NX = 121;              // samples along cortex
  var LF_MIN = -4, LF_MAX = 5, DLF = 0.1;   // log2 cpd grid: 0.0625 to 32 cpd
  var NF = Math.round((LF_MAX - LF_MIN) / DLF) + 1;
  var M_SCALE = 17.3;        // mm; M(e) = 17.3 / (e + e2)  (Horton & Hoyt, 1991)
  var SIG_RF = 1.0;          // mm; receptive-field sd on cortex
  var FULL_FIELD = 24;       // probe sizes at or above this fill the meridian

  var DEFAULTS = {
    // attention
    gain: 2.0,       // peak multiplicative gain of the attention field
    fAtt: 2.0,       // attended spatial frequency, cpd
    eAtt: 2.0,       // attended eccentricity, deg
    sigAf: 0.5,      // feature width of the attention field, octaves (sd)
    cortRule: 'mag', // 'mag': ridge follows M(e); 'pref': ridge follows p(e)
    // normalization
    sigma: 0.1,      // semi-saturation (contrast units, see sRef below)
    n: 2.0,          // exponent
    sigSf: 2.0,      // suppressive pool width in SF, octaves (sd)
    sigSx: 4.0,      // suppressive pool width on cortex, mm (sd)
    // population
    sigT: 0.6,       // single-unit SF tuning width, octaves (sd)
    sigPop: 1.5,     // spread of preferred SFs at one eccentricity, octaves (sd); feeds the pool
    sigVox: 1.5,     // SF band a voxel reads out, centred on the local preferred SF, octaves (sd)
    e2: 0.75,        // deg; M(e) = 17.3 / (e + e2)
    a: 0.12,         // preferred period (deg) = a * e + b  (Broderick et al., 2022)
    b: 0.35
  };

  function erf(x) {
    var s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }

  function gaussKernel(sd, step) {
    var h = Math.max(1, Math.ceil(3.5 * sd / step));
    var k = new Float64Array(2 * h + 1), sum = 0, j;
    for (j = -h; j <= h; j++) { k[j + h] = Math.exp(-0.5 * Math.pow(j * step / sd, 2)); sum += k[j + h]; }
    for (j = 0; j < k.length; j++) k[j] /= sum;
    return { k: k, h: h };
  }

  function create(P) {
    var p = {}, key;
    for (key in DEFAULTS) p[key] = DEFAULTS[key];
    for (key in (P || {})) if (P[key] !== undefined) p[key] = P[key];

    function xOf(e) { return M_SCALE * Math.log(1 + e / p.e2); }
    function eOf(x) { return p.e2 * (Math.exp(x / M_SCALE) - 1); }
    var xMax = xOf(E_MAX), dx = xMax / (NX - 1);

    var es = new Float64Array(NX), lfs = new Float64Array(NF), i, k;
    for (i = 0; i < NX; i++) es[i] = eOf(i * dx);
    for (k = 0; k < NF; k++) lfs[k] = LF_MIN + k * DLF;

    function prefSF(e) { return 1 / (p.a * e + p.b); }
    function ridgeSF(model, e) {
      if (model === 'stim') return p.fAtt;
      if (model === 'cort') {
        return p.cortRule === 'pref'
          ? p.fAtt * prefSF(e) / prefSF(p.eAtt)
          : p.fAtt * (p.eAtt + p.e2) / (e + p.e2);
      }
      return NaN;
    }

    // Density of units over preferred SF at each eccentricity (unit integral per column).
    // w weights the normalization pool. wv is what a voxel at that location reads out:
    // the same centre, but its own width, so the readout can be narrower than the pool.
    var w = new Float64Array(NX * NF), wv = new Float64Array(NX * NF);
    var wn = 1 / (p.sigPop * Math.sqrt(2 * Math.PI)), wvn = 1 / (p.sigVox * Math.sqrt(2 * Math.PI));
    for (i = 0; i < NX; i++) {
      var c0 = Math.log2(prefSF(es[i]));
      for (k = 0; k < NF; k++) {
        w[i * NF + k] = wn * Math.exp(-0.5 * Math.pow((lfs[k] - c0) / p.sigPop, 2));
        wv[i * NF + k] = wvn * Math.exp(-0.5 * Math.pow((lfs[k] - c0) / p.sigVox, 2));
      }
    }

    // Attention fields.
    function makeField(model) {
      var A = new Float64Array(NX * NF);
      var g = Math.max(0, p.gain - 1);
      for (var i = 0; i < NX; i++) {
        var r = model === 'none' ? 0 : Math.log2(ridgeSF(model, es[i]));
        for (var k = 0; k < NF; k++) {
          A[i * NF + k] = model === 'none' ? 1 : 1 + g * Math.exp(-0.5 * Math.pow((lfs[k] - r) / p.sigAf, 2));
        }
      }
      return A;
    }
    var A = { none: makeField('none'), stim: makeField('stim'), cort: makeField('cort') };

    var Kx = gaussKernel(p.sigSx, dx), Kf = gaussKernel(p.sigSf, DLF);
    var sigN = Math.pow(p.sigma, p.n);
    var SQ2RF = Math.SQRT2 * SIG_RF;

    // Spatial stimulus drive (already raised to n) for a probe spanning eP +/- size/2.
    function spatialProfile(eP, size) {
      var out = new Float64Array(NX), i;
      if (size >= FULL_FIELD) { for (i = 0; i < NX; i++) out[i] = 1; return out; }
      var lo = eP - size / 2, hi = Math.min(eP + size / 2, E_MAX + 1);
      var xlo = lo <= 0 ? -xOf(-lo) : xOf(lo), xhi = xOf(hi);
      for (i = 0; i < NX; i++) {
        var x = i * dx;
        var s = 0.5 * (erf((x - xlo) / SQ2RF) - erf((x - xhi) / SQ2RF));
        out[i] = s > 1e-6 ? Math.pow(s, p.n) : 0;
      }
      return out;
    }

    // Feature stimulus drive (raised to n) for a stimulus at fP cpd with bandwidth bw octaves.
    function sfProfile(c, fP, bw) {
      var sd = Math.sqrt(p.sigT * p.sigT + bw * bw);
      var amp = c * p.sigT / sd;
      var lf0 = Math.log2(fP);
      var t = new Float64Array(NF), k0 = NF, k1 = -1;
      for (var k = 0; k < NF; k++) {
        var z = (lfs[k] - lf0) / sd;
        if (Math.abs(z) > 4.5) continue;
        t[k] = Math.pow(amp * Math.exp(-0.5 * z * z), p.n);
        if (k < k0) k0 = k;
        k1 = k;
      }
      return { t: t, k0: k0, k1: k1 };
    }

    // Spatially pooled, density- and attention-weighted drive reaching column ix.
    function columnAt(model, ix, sxn) {
      var G = new Float64Array(NF), Af = A[model], h = Kx.h;
      for (var j = -h; j <= h; j++) {
        var ii = ix + j;
        if (ii < 0) ii = -ii;           // mirror across the fovea
        if (ii >= NX) continue;
        var wt = Kx.k[j + h] * sxn[ii];
        if (wt === 0) continue;
        var o = ii * NF;
        for (var k = 0; k < NF; k++) G[k] += wt * w[o + k] * Af[o + k];
      }
      return { ix: ix, G: G, sx: sxn[ix], model: model };
    }

    // Response of every unit in the column; returns the voxel-weighted pooled response.
    var sRef = 1;
    function respond(col, sf, outR) {
      var t = sf.t, k0 = sf.k0, k1 = sf.k1, G = col.G, h = Kf.h;
      var Af = A[col.model], o = col.ix * NF, pooled = 0;
      if (outR) outR.fill(0);
      if (col.sx === 0 || k1 < k0) return 0;
      for (var k = k0; k <= k1; k++) {
        var s = 0;
        var a0 = Math.max(k0, k - h), a1 = Math.min(k1, k + h);
        for (var kk = a0; kk <= a1; kk++) s += Kf.k[kk - k + h] * t[kk] * G[kk];
        var r = Af[o + k] * col.sx * t[k] / (s / sRef + sigN);
        if (outR) outR[k] = r;
        pooled += wv[o + k] * r;
      }
      return pooled * DLF;
    }

    // sigma is expressed relative to a full-field grating at the locally preferred SF:
    // for that stimulus an unattended unit follows c^n / (c^n + sigma^n).
    (function calibrate() {
      var iRef = Math.round(xOf(3) / dx);
      var col = columnAt('none', iRef, spatialProfile(0, FULL_FIELD));
      var sf = sfProfile(1, prefSF(es[iRef]), 0);
      var kRef = Math.round((Math.log2(prefSF(es[iRef])) - LF_MIN) / DLF);
      var s = 0, h = Kf.h;
      for (var kk = Math.max(sf.k0, kRef - h); kk <= Math.min(sf.k1, kRef + h); kk++) s += Kf.k[kk - kRef + h] * sf.t[kk] * col.G[kk];
      sRef = s > 0 ? s : 1;
    })();

    // Contrast-free description of the units a probe drives. Both the drive and the
    // suppressive pool scale with c^n, so each unit is an exact Naka-Rushton function
    // of contrast: r_k(c) = num_k c^n / (alpha_k c^n + sigma^n).
    // sf is a unit-contrast profile from sfProfile(1, f, bw); it can be reused across columns.
    function units(col, sf) {
      var t = sf.t, k0 = sf.k0, k1 = sf.k1, h = Kf.h;
      var Af = A[col.model], o = col.ix * NF, len = Math.max(0, k1 - k0 + 1);
      var num = new Float64Array(len), alpha = new Float64Array(len);
      if (col.sx === 0) return { num: num, alpha: alpha, len: 0 };
      for (var k = k0; k <= k1; k++) {
        var s = 0, a0 = Math.max(k0, k - h), a1 = Math.min(k1, k + h);
        for (var kk = a0; kk <= a1; kk++) s += Kf.k[kk - k + h] * t[kk] * col.G[kk];
        alpha[k - k0] = s / sRef;
        num[k - k0] = wv[o + k] * Af[o + k] * col.sx * t[k] * DLF;
      }
      return { num: num, alpha: alpha, len: len };
    }
    // Pooled (voxel-weighted) response of the column at contrast c.
    function pooledAt(u, c) {
      var cn = Math.pow(c, p.n), out = 0;
      for (var j = 0; j < u.len; j++) out += u.num[j] * cn / (u.alpha[j] * cn + sigN);
      return out;
    }
    // Measured population contrast response function plus its Naka-Rushton estimate.
    function crf(u, contrasts) {
      var ys = new Float64Array(contrasts.length), i;
      for (i = 0; i < contrasts.length; i++) ys[i] = pooledAt(u, contrasts[i]);
      var rInf = 0, aBar = 0, wsum = 0;
      for (i = 0; i < u.len; i++) {
        if (u.alpha[i] > 0) rInf += u.num[i] / u.alpha[i];
        aBar += u.num[i] * u.alpha[i]; wsum += u.num[i];
      }
      aBar = wsum > 0 ? aBar / wsum : 1;
      var init = { rmax: rInf, c50: p.sigma / Math.pow(Math.max(aBar, 1e-9), 1 / p.n), n: p.n };
      return { ys: ys, fit: fitNakaRushton(contrasts, ys, init) };
    }

    function columnIndex(e) { return Math.max(0, Math.min(NX - 1, Math.round(xOf(e) / dx))); }

    // Pooled response at the probe's own location.
    function probeColumn(model, eP, size) { return columnAt(model, columnIndex(eP), spatialProfile(eP, size)); }
    function probeResponse(model, st) {
      return respond(probeColumn(model, st.e, st.size), sfProfile(st.c, st.f, st.bw || 0));
    }

    // Full neural image for one stimulus: unit responses R[i*NF+k] and pooled[i].
    function image(model, st) {
      var sxn = spatialProfile(st.e, st.size), sf = sfProfile(st.c, st.f, st.bw || 0);
      var R = new Float64Array(NX * NF), pooled = new Float64Array(NX), row = new Float64Array(NF);
      for (var i = 0; i < NX; i++) {
        if (sxn[i] === 0) continue;
        pooled[i] = respond(columnAt(model, i, sxn), sf, row);
        R.set(row, i * NF);
      }
      return { R: R, pooled: pooled };
    }

    return {
      p: p, NX: NX, NF: NF, es: es, lfs: lfs, dx: dx, xMax: xMax, w: w, wv: wv, A: A,
      xOf: xOf, eOf: eOf, prefSF: prefSF, ridgeSF: ridgeSF,
      columnIndex: columnIndex, probeColumn: probeColumn, respond: respond,
      sfProfile: sfProfile, probeResponse: probeResponse, image: image,
      units: units, pooledAt: pooledAt, crf: crf
    };
  }

  // Least-squares Naka-Rushton fit, R(c) = Rmax c^n / (c^n + c50^n), by
  // Levenberg-Marquardt on (ln Rmax, ln c50, ln n). Returns {rmax, c50, n, rmse}.
  function fitNakaRushton(cs, ys, init) {
    var m = cs.length, j, ymax = 0;
    for (j = 0; j < m; j++) if (ys[j] > ymax) ymax = ys[j];
    if (!(ymax > 0)) return { rmax: NaN, c50: NaN, n: NaN, rmse: NaN };
    var lc = new Float64Array(m), y = new Float64Array(m);
    for (j = 0; j < m; j++) { lc[j] = Math.log(cs[j]); y[j] = ys[j] / ymax; }
    var th = [
      Math.log(Math.max((init && init.rmax > 0 ? init.rmax : ymax * 1.2) / ymax, 1e-6)),
      Math.log(init && init.c50 > 0 ? init.c50 : 0.2),
      Math.log(init && init.n > 0 ? init.n : 2)
    ];
    var LO = [-8, Math.log(1e-3), Math.log(0.3)], HI = [8, Math.log(8), Math.log(8)];
    function sse(t) {
      var R = Math.exp(t[0]), n = Math.exp(t[2]), e = 0;
      for (var j = 0; j < m; j++) { var d = y[j] - R / (1 + Math.exp(n * (t[1] - lc[j]))); e += d * d; }
      return e;
    }
    var err = sse(th), lam = 1e-3;
    for (var it = 0; it < 40; it++) {
      var R = Math.exp(th[0]), n = Math.exp(th[2]);
      var a00 = 0, a01 = 0, a02 = 0, a11 = 0, a12 = 0, a22 = 0, g0 = 0, g1 = 0, g2 = 0;
      for (j = 0; j < m; j++) {
        var z = n * (th[1] - lc[j]), u = 1 / (1 + Math.exp(z)), f = R * u;
        var d0 = f, d1 = -f * (1 - u) * n, d2 = -f * (1 - u) * z, r = y[j] - f;
        a00 += d0 * d0; a01 += d0 * d1; a02 += d0 * d2; a11 += d1 * d1; a12 += d1 * d2; a22 += d2 * d2;
        g0 += d0 * r; g1 += d1 * r; g2 += d2 * r;
      }
      var improved = false;
      for (var tries = 0; tries < 8 && !improved; tries++) {
        var b00 = a00 * (1 + lam) + 1e-12, b11 = a11 * (1 + lam) + 1e-12, b22 = a22 * (1 + lam) + 1e-12;
        var det = b00 * (b11 * b22 - a12 * a12) - a01 * (a01 * b22 - a12 * a02) + a02 * (a01 * a12 - b11 * a02);
        if (Math.abs(det) < 1e-300) { lam *= 10; continue; }
        var s0 = (g0 * (b11 * b22 - a12 * a12) - a01 * (g1 * b22 - a12 * g2) + a02 * (g1 * a12 - b11 * g2)) / det;
        var s1 = (b00 * (g1 * b22 - a12 * g2) - g0 * (a01 * b22 - a12 * a02) + a02 * (a01 * g2 - g1 * a02)) / det;
        var s2 = (b00 * (b11 * g2 - g1 * a12) - a01 * (a01 * g2 - g1 * a02) + g0 * (a01 * a12 - b11 * a02)) / det;
        var cand = [th[0] + s0, th[1] + s1, th[2] + s2];
        for (var q = 0; q < 3; q++) cand[q] = Math.max(LO[q], Math.min(HI[q], cand[q]));
        var e2 = sse(cand);
        if (e2 < err) {
          var gainRel = (err - e2) / Math.max(err, 1e-30);
          th = cand; err = e2; lam = Math.max(lam / 5, 1e-9); improved = true;
          if (gainRel < 1e-9) it = 1e9;
        } else lam *= 6;
      }
      if (!improved || err < 1e-18) break;
    }
    return { rmax: Math.exp(th[0]) * ymax, c50: Math.exp(th[1]), n: Math.exp(th[2]), rmse: Math.sqrt(err / m) * ymax };
  }
  function nakaRushton(fit, c) {
    var cn = Math.pow(c, fit.n);
    return fit.rmax * cn / (cn + Math.pow(fit.c50, fit.n));
  }

  return {
    create: create, DEFAULTS: DEFAULTS, fitNakaRushton: fitNakaRushton, nakaRushton: nakaRushton,
    E_MAX: E_MAX, NX: NX, NF: NF, LF_MIN: LF_MIN, LF_MAX: LF_MAX, DLF: DLF,
    M_SCALE: M_SCALE, FULL_FIELD: FULL_FIELD
  };
});
