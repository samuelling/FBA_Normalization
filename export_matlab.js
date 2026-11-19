/*
 * Writes the current simulation as a self-contained MATLAB function file.
 * The MATLAB code is a line-for-line port of model.js (same grids, kernels,
 * calibration and readout), with the dashboard's current settings filled in.
 * No DOM access: runs in the browser (window.FBAExport) and in node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FBAExport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function num(v) { return String(+Number(v).toPrecision(8)); }

  // cfg: { P: model parameters, probe: {e, f, c, size, bw}, measure: 'c50' | 'rmax' | 'resp', fullField: size threshold }
  function matlab(cfg) {
    var P = cfg.P, pr = cfg.probe;
    var size = pr.size >= (cfg.fullField || 24) ? 'Inf' : num(pr.size);
    var stamp = cfg.date || new Date().toISOString().slice(0, 10);
    return String.raw`function out = fba_normalization_sim()
% FBA_NORMALIZATION_SIM  Stimulus-based vs cortical-based feature-based attention
% in the normalization model of attention (Reynolds & Heeger, 2009).
%
%   out = fba_normalization_sim() runs the simulation with the parameters set
%   in section 1 of this file, prints the estimated contrast response
%   parameters, draws a summary figure and returns everything in OUT.
%
% WHAT IS SIMULATED
%   An observer attends a grating (P.fAtt cpd at P.eAtt deg). We ask what that
%   does to the population contrast response function (CRF) of an ignored
%   probe somewhere else in the visual field, under two hypotheses about which
%   units feature-based attention boosts:
%
%     'stim'  Stimulus-based. Units tuned to the attended spatial frequency,
%             in cpd, are boosted at every eccentricity.
%     'cort'  Cortical-based. The boosted spatial frequency is rescaled with
%             eccentricity, so that it is the same in cortical terms: higher
%             cpd towards the fovea, lower cpd in the periphery.
%     'none'  No attention (the baseline both are compared against).
%
% THE MODEL
%   Units live on a "neural image" with two axes:
%     x   cortical distance (mm) along one meridian. Working in mm means that
%         receptive fields and the suppressive pool have a fixed size on
%         cortex and therefore grow with eccentricity in the visual field.
%     f   preferred spatial frequency (log2 cpd).
%
%   Each unit's response follows the normalization model of attention:
%
%       R(x,f) = A(x,f) * E(x,f)^n / ( S(x,f) + sigma^n )
%
%     E   stimulus drive: how well the stimulus matches the unit's receptive
%         field (in x) and its spatial frequency tuning (in f), times contrast.
%     A   attention field: multiplicative gain, 1 where attention does nothing.
%         THIS IS THE ONLY TERM THAT DIFFERS BETWEEN THE TWO HYPOTHESES.
%     S   suppressive drive: the attended drive A*E^n of all units, weighted by
%         how many units there are, pooled over a neighbourhood in x and f.
%
%   Both attention fields are spatially global (the same at every x for a
%   given cortical/stimulus frequency) and both pass through the attended
%   grating, so the two hypotheses agree at the attended eccentricity and
%   diverge away from it.
%
% THE MEASUREMENT
%   A voxel at the probe's cortical location is modelled as a weighted sum of
%   the units there. The weights are a band along f centred on the locally
%   preferred spatial frequency. The width of that band is not set directly:
%   it is solved, at each eccentricity, so that the voxel's SF tuning has the
%   measured bandwidth (P.bwFovea, P.bw9). The pooled response is sampled at
%   several contrasts and fitted with a Naka-Rushton function,
%
%       r(c) = Rmax * c^n / (c^n + c50^n),
%
%   and attention effects are reported as changes in the fitted c50 (contrast
%   gain), in Rmax (response gain), and in the response at one contrast.
%
% OUTPUT (fields of OUT)
%   P, probe, contrasts      the settings used
%   conds                    {'none','stim','cort'}; row order of the arrays below
%   crf                      3 x nContrasts pooled responses at the probe
%   c50, rmax, nfit          1 x 3 Naka-Rushton estimates at the probe
%   respAtProbeContrast      1 x 3 pooled response at probe.contrast
%   effect                   attention effects at the probe, in percent: [stim; cort]
%   tuning                   the same estimates as a function of probe SF
%   map                      the same over probe eccentricity x SF (if doMap)
%   model                    the neural image: grids, densities, attention fields,
%                            and the solved voxel band (model.sigVox, one per column)
%   design                   predicted pSFT changes for the 2025 design (if doDesign)
%
% REQUIREMENTS
%   Base MATLAB R2016b or later (implicit expansion). No toolboxes.
%   Also runs in GNU Octave.
%
% Exported from the FBA Normalization dashboard on ${stamp}.
% Source: https://github.com/samuelling/FBA_Normalization

%% ------------------------------------------------------------ 1. Parameters
% ---- Attention
P.gain     = ${num(P.gain)};      % peak gain of the attention field (1 = no attention)
P.fAtt     = ${num(P.fAtt)};      % attended spatial frequency (cpd)
P.eAtt     = ${num(P.eAtt)};      % attended eccentricity (deg)
P.sigAf    = ${num(P.sigAf)};      % width of the attention field along SF (octaves, sd)
P.cortRule = '${P.cortRule}';  % how the cortical model rescales the attended SF with eccentricity:
                       %   'mag'   with cortical magnification M(e): constant cycles per mm of cortex
                       %   'pref'  with the local preferred SF p(e): same place in the local tuning
P.k        = ${num(P.k === undefined ? 1 : P.k)};      % scaling exponent of the cortical model: the rescaling is raised
                       % to k. 0 = no rescaling (same as stimulus-based), 1 = the full rule.

% ---- Normalization
P.sigma  = ${num(P.sigma)};      % semi-saturation, in contrast units. Calibrated in build_model so that
                       % a full-field grating at the preferred SF has an unattended c50 = sigma.
P.n      = ${num(P.n)};        % exponent
P.sigSf  = ${num(P.sigSf)};        % width of the suppressive pool along SF (octaves, sd)
P.sigSx  = ${num(P.sigSx)};        % width of the suppressive pool on cortex (mm, sd)

% ---- Population
P.sigT   = ${num(P.sigT)};      % SF tuning width of a single unit (octaves, sd)
P.sigPop = ${num(P.sigPop)};      % spread of preferred SFs at one eccentricity (octaves, sd).
                       % These are the units that feed the suppressive pool.
P.bwFovea = ${num(P.bwFovea)};     % voxel SF tuning bandwidth at the fovea (octaves, full width at half max)
P.bw9     = ${num(P.bw9)};     % the same at 9 deg; in between and beyond it changes linearly with
                       % eccentricity (Aghajari, Vinke & Ling, 2020). Defined for full-field
                       % narrowband stimuli at 90% contrast. The band of units a voxel reads
                       % out is solved from these in build_model.
P.e2     = ${num(P.e2)};     % cortical magnification M(e) = 17.3/(e + e2) mm/deg (Horton & Hoyt, 1991)
P.a      = ${num(P.a)};     % preferred period (deg) = a*e + b, so preferred SF p(e) = 1/(a*e + b)
P.b      = ${num(P.b)};     % (Broderick, Simoncelli & Winawer, 2022)

% ---- Probe stimulus. It is ignored, and assumed to sit in the hemifield
% opposite the attended grating so the two do not share a normalization pool.
probe.ecc      = ${num(pr.e)};      % eccentricity of the probe centre (deg)
probe.sf       = ${num(pr.f)};      % centre spatial frequency (cpd)
probe.size     = ${size};      % extent along the meridian (deg). Inf = full field
probe.bw       = ${num(pr.bw)};      % SF bandwidth (octaves, sd). 0 = grating
probe.contrast = ${num(pr.c)};   % contrast for the single-contrast readout (0 to 1)

% ---- Measurement
contrasts   = logspace(-2, 0, 9);      % contrasts at which each CRF is sampled (1% to 100%)
sfAxis      = 2.^(-3:0.0625:4);        % probe SFs for the tuning curves (0.125 to 16 cpd)
doMap       = true;                    % also map the effects over eccentricity x SF (the slow part)
mapEcc      = linspace(0.25, 11.75, 32);   % probe eccentricities for the map (deg)
mapSF       = 2.^(-3:0.25:4);              % probe SFs for the map (cpd)
doPlot      = true;                    % draw the summary figure
plotMeasure = '${cfg.measure || 'c50'}';                   % what the tuning curve and maps show:
                                       %   'c50'   reduction in c50 (%), i.e. contrast gain
                                       %   'rmax'  increase in Rmax (%), i.e. response gain
                                       %   'resp'  increase in response at probe.contrast (%)
doDesign       = true;                 % also simulate the pSFT design of Ramirez, Wang & Ling (2025)
designContrast = ${num(cfg.designContrast === undefined ? 1 : cfg.designContrast)};   % contrast of its pSFT stimuli (the study used 100%)

%% ------------------------------------------------- 2. Build the neural image
M     = build_model(P);
conds = {'none', 'stim', 'cort'};

%% --------------------------------- 3. Contrast response function at the probe
% For each attention condition: find the drive reaching the probe's cortical
% column, describe every unit there, sample the pooled response at each
% contrast, and fit a Naka-Rushton function to those samples.
crf  = zeros(3, numel(contrasts));
c50  = zeros(1, 3);  rmax = zeros(1, 3);  nfit = zeros(1, 3);  rprobe = zeros(1, 3);
for ic = 1:3
    col = probe_column(M, conds{ic}, probe.ecc, probe.size);
    u   = drive_units(M, col, probe.sf, probe.bw);
    crf(ic, :) = pooled_response(M, u, contrasts);
    [c50(ic), rmax(ic), nfit(ic)] = fit_naka_rushton(contrasts, crf(ic, :), u.c50Start, P.n);
    rprobe(ic) = pooled_response(M, u, probe.contrast);
end

out.P = P;  out.probe = probe;  out.contrasts = contrasts;  out.conds = conds;
out.crf = crf;  out.c50 = c50;  out.rmax = rmax;  out.nfit = nfit;
out.respAtProbeContrast = rprobe;
out.effect = attention_effects(c50(:), rmax(:), rprobe(:));   % each field is 2 x 1: [stim; cort]

fprintf('\nProbe: %.2f cpd at %.2f deg. Attended: %.2f cpd at %.2f deg.\n', probe.sf, probe.ecc, P.fAtt, P.eAtt);
fprintf('Gain ridge at the probe eccentricity: stimulus-based %.2f cpd, cortical-based %.2f cpd.\n', ...
    ridge_sf(P, 'stim', probe.ecc), ridge_sf(P, 'cort', probe.ecc));
fprintf('\n%-16s %8s %8s %6s %10s %10s\n', 'Condition', 'c50 (%)', 'Rmax', 'n', 'c50 change', 'Rmax change');
names = {'No attention', 'Stimulus-based', 'Cortical-based'};
for ic = 1:3
    if ic == 1
        fprintf('%-16s %8.2f %8.3f %6.2f %10s %10s\n', names{ic}, 100*c50(ic), rmax(ic), nfit(ic), '-', '-');
    else
        fprintf('%-16s %8.2f %8.3f %6.2f %+9.1f%% %+9.1f%%\n', names{ic}, 100*c50(ic), rmax(ic), nfit(ic), ...
            100*(c50(ic)/c50(1) - 1), 100*(rmax(ic)/rmax(1) - 1));
    end
end

%% ------------------- 4. Attention effect as a function of probe SF (tuning)
% Same measurement, repeated for a probe of every SF in sfAxis at the probe
% eccentricity. The two hypotheses predict the same tuning curve, centred on
% different SFs.
nS = numel(sfAxis);
T.c50 = zeros(3, nS);  T.rmax = zeros(3, nS);  T.resp = zeros(3, nS);
for ic = 1:3
    col = probe_column(M, conds{ic}, probe.ecc, probe.size);   % does not depend on SF
    for is = 1:nS
        u = drive_units(M, col, sfAxis(is), probe.bw);
        r = pooled_response(M, u, contrasts);
        [T.c50(ic, is), T.rmax(ic, is)] = fit_naka_rushton(contrasts, r, u.c50Start, P.n);
        T.resp(ic, is) = pooled_response(M, u, probe.contrast);
    end
end
T.sf     = sfAxis;
T.effect = attention_effects(T.c50, T.rmax, T.resp);
out.tuning = T;

%% --------------- 5. Attention effect over probe eccentricity x SF (the map)
% Each point of the map is a separate experiment: put the probe at that
% eccentricity and SF, estimate its CRF with and without attention.
if doMap
    nE = numel(mapEcc);  nF = numel(mapSF);
    Mp.c50 = zeros(3, nE, nF);  Mp.rmax = zeros(3, nE, nF);  Mp.resp = zeros(3, nE, nF);
    fprintf('\nComputing the eccentricity x SF map (%d fits) ...\n', 3*nE*nF);
    for ic = 1:3
        for ie = 1:nE
            col = probe_column(M, conds{ic}, mapEcc(ie), probe.size);
            for is = 1:nF
                u = drive_units(M, col, mapSF(is), probe.bw);
                r = pooled_response(M, u, contrasts);
                [Mp.c50(ic, ie, is), Mp.rmax(ic, ie, is)] = fit_naka_rushton(contrasts, r, u.c50Start, P.n);
                Mp.resp(ic, ie, is) = pooled_response(M, u, probe.contrast);
            end
        end
    end
    Mp.ecc = mapEcc;  Mp.sf = mapSF;
    Mp.effect = attention_effects(Mp.c50, Mp.rmax, Mp.resp);
    out.map = Mp;
end
out.model = M;

%% ------------------- 6. Predictions for the 2025 pSFT design (Ramirez et al.)
% The study attended a letter stream filtered around 0.5 cpd (LSF) or 2 cpd
% (HSF) in one hemifield, at P.eAtt (3.5 deg in the study), and measured each
% voxel's SF tuning (pSFT) in the other hemifield with full-field bandlimited
% noise at 40 log-spaced SFs from 0.1 to 12 cpd, fitted with a log-Gaussian,
% against a fixation baseline. Here the noise is approximated by narrowband
% stimuli. For each model and attended SF we report, per voxel eccentricity:
%   peakChange  percent change in the fitted pSFT peak
%   dist        the voxel's baseline peak relative to the attended SF (octaves)
% and the summaries the paper used: the mean, the slope against dist (% per
% octave; negative = attraction) and the slope against eccentricity.
if doDesign
    out.design = simulate_psft_design(P, designContrast);
    fprintf('\n2025 pSFT design (attended at %.2f deg, pSFT contrast %.0f%%):\n', P.eAtt, 100 * designContrast);
    fprintf('%-34s %10s %12s %12s %10s\n', 'Prediction', 'Mean peak', 'Slope/oct', 'Slope/deg', 'Mean BW');
    keys = {'stim_hsf', 'stim_lsf', 'cort_hsf', 'cort_lsf'};
    for ik = 1:4
        r = out.design.(keys{ik});
        fprintf('%-34s %+9.2f%% %12.2f %12.3f %+9.2f%%\n', r.label, r.meanPeakChange, r.slopeDist, r.slopeEcc, r.meanBwChange);
    end
end

%% -------------------------------------------------------------- 7. Figure
if doPlot
    plot_summary(out, plotMeasure, doMap);
end
end


%% =========================================================================
%%                              MODEL FUNCTIONS
%% =========================================================================

function M = build_model(P)
% BUILD_MODEL  Lay out the neural image and everything that does not depend on
% the stimulus: unit densities, attention fields, pooling kernels, calibration.

mScale = 17.3;                 % mm; M(e) = 17.3 / (e + e2)
eMax   = 12;                   % deg; extent of the simulated meridian
NX     = 121;                  % samples along cortex
lf     = -4 + 0.1 * (0:90);    % preferred SF grid, log2 cpd (0.0625 to 32 cpd)

% Cortical distance from the fovea is the integral of M(e):
%   x(e) = 17.3 * log(1 + e/e2), and its inverse e(x).
xOf  = @(e) mScale .* log(1 + e ./ P.e2);
xMax = xOf(eMax);
x    = linspace(0, xMax, NX);            % mm, uniform on cortex
ecc  = P.e2 .* (exp(x ./ mScale) - 1);   % deg, receptive-field eccentricity of each column

M.P = P;  M.NX = NX;  M.NF = numel(lf);  M.eMax = eMax;  M.sigRF = 1.0;   % RF sd on cortex, mm
M.x = x;  M.dx = x(2) - x(1);  M.ecc = ecc;  M.lf = lf;  M.dlf = 0.1;  M.xOf = xOf;

% Density of units over preferred SF at each eccentricity (rows: cortex,
% columns: SF; each row integrates to 1), centred on the local preferred SF
% p(e) = 1/(a*e + b). This is the population that feeds the suppressive pool.
% The voxel's own weights, M.wv, are set at the end of this function; until
% then they are a placeholder (they play no part in the suppressive drive).
lfPref = log2(1 ./ (P.a .* ecc + P.b)).';                                   % NX x 1
M.w    = exp(-0.5 * ((lf - lfPref) ./ P.sigPop).^2) ./ (P.sigPop * sqrt(2*pi));
M.wv   = M.w;

% Attention fields A(x,f): a ridge of gain along SF whose centre is set by
% the hypothesis (see ridge_sf). Width and peak gain are the same everywhere.
g = max(P.gain - 1, 0);
M.A.none = ones(NX, M.NF);
lfRidge  = log2(ridge_sf(P, 'stim', ecc)).';
M.A.stim = 1 + g .* exp(-0.5 * ((lf - lfRidge) ./ P.sigAf).^2);
lfRidge  = log2(ridge_sf(P, 'cort', ecc)).';
M.A.cort = 1 + g .* exp(-0.5 * ((lf - lfRidge) ./ P.sigAf).^2);

% Suppressive pooling kernels (unit sum): Gaussian over cortex and over SF.
M.Kx = gauss_kernel(P.sigSx, M.dx);
M.Kf = gauss_kernel(P.sigSf, M.dlf);

% Calibration. The suppressive drive is divided by sRef, its value for an
% unattended full-field grating at the locally preferred SF (taken at 3 deg).
% For that stimulus a unit at the preferred SF then follows
% c^n / (c^n + sigma^n), which makes sigma its c50.
M.sRef = 1;
col    = probe_column(M, 'none', 3, Inf);
fRef   = 1 / (P.a * ecc(col.ix) + P.b);
u      = drive_units(M, col, fRef, 0);
kRef   = round((log2(fRef) - lf(1)) / M.dlf) + 1;
if u.alpha(kRef) > 0
    M.sRef = u.alpha(kRef);
end

% Voxel readout band. What is measured in fMRI is a voxel's SF tuning
% bandwidth: the full width at half max of its response to full-field
% narrowband stimuli at high contrast. At a few anchor eccentricities we
% find, by bisection, the band of units (sd, octaves) the voxel must read
% out for the model voxel to have that bandwidth, then interpolate.
anchors = [0.25 1 2 3 4.5 6 7.5 9 10.5 12];       % deg
svA     = zeros(size(anchors));
cn      = 0.9 ^ P.n;                               % bandwidth is specified at 90% contrast
for ia = 1:numel(anchors)
    col = probe_column(M, 'none', anchors(ia), Inf);
    % R(j,k): response of unit k to a full-field grating at the j-th grid SF
    R = zeros(M.NF, M.NF);
    for j = 1:M.NF
        u = drive_units(M, col, 2^lf(j), 0);
        R(j, :) = u.t .* cn ./ (u.alpha .* cn + P.sigma^P.n);
    end
    target = max(1, P.bwFovea + (P.bw9 - P.bwFovea) * anchors(ia) / 9);
    % Search between a single-unit-like band and the spread of the local
    % population (a voxel cannot read out units that are not there). In that
    % range the bandwidth grows monotonically with the band.
    lo = 0.15;  hi = max(0.15, P.sigPop);
    for it = 1:30
        mid = 0.5 * (lo + hi);
        if voxel_bandwidth(R, lf, lfPref(col.ix), mid) > target
            hi = mid;
        else
            lo = mid;
        end
    end
    svA(ia) = 0.5 * (lo + hi);
end
M.sigVox = interp1(anchors, svA, min(max(ecc, anchors(1)), anchors(end)));   % 1 x NX, octaves (sd)
M.wv     = exp(-0.5 * ((lf - lfPref) ./ M.sigVox.').^2) ./ (M.sigVox.' * sqrt(2*pi));
end


function bw = voxel_bandwidth(R, lf, lfCentre, sv)
% VOXEL_BANDWIDTH  Full width at half max (octaves) of a voxel's SF tuning
% when it reads out a Gaussian band of units (sd sv, centred on lfCentre).
% Returns Inf if the tuning never falls to half its peak on the SF grid.
wk = exp(-0.5 * ((lf - lfCentre) ./ sv).^2);
p  = (R * wk.').';                              % pooled tuning curve, 1 x NF
[pk, ip] = max(p);
half = pk / 2;
bw   = Inf;
iLo  = find(p(1:ip-1) < half, 1, 'last');       % last point below half, left of the peak
iHi  = find(p(ip+1:end) < half, 1, 'first');    % first point below half, right of the peak
if isempty(iLo) || isempty(iHi)
    return
end
dlf = lf(2) - lf(1);
j   = iLo + 1;       lo = lf(j) - (p(j) - half) / (p(j) - p(j-1)) * dlf;   % interpolate the crossings
j   = ip + iHi - 1;  hi = lf(j) + (p(j) - half) / (p(j) - p(j+1)) * dlf;
bw  = hi - lo;
end


function f = ridge_sf(P, cond, e)
% RIDGE_SF  Spatial frequency (cpd) at the centre of the attention field, at
% eccentricity e (deg). This function is the whole difference between the
% two hypotheses.
switch cond
    case 'stim'
        % Stimulus-based: the attended cpd, everywhere.
        f = P.fAtt .* ones(size(e));
    case 'cort'
        if strcmp(P.cortRule, 'pref')
            % Rescale with the local preferred SF, p(e) = 1/(a*e + b).
            ratio = (P.a .* P.eAtt + P.b) ./ (P.a .* e + P.b);
        else
            % Rescale with cortical magnification, M(e) proportional to 1/(e + e2).
            ratio = (P.eAtt + P.e2) ./ (e + P.e2);
        end
        % Partial scaling: k = 0 leaves the attended cpd unchanged, k = 1 applies the rule.
        f = P.fAtt .* ratio .^ P.k;
    otherwise
        f = nan(size(e));
end
end


function k = gauss_kernel(sd, step)
% GAUSS_KERNEL  Gaussian kernel with unit sum, sampled every STEP, out to 3.5 sd.
h = max(1, ceil(3.5 * sd / step));
k = exp(-0.5 * ((-h:h) .* step ./ sd).^2);
k = k ./ sum(k);
end


function sxn = spatial_drive(M, eP, sz)
% SPATIAL_DRIVE  How strongly a probe spanning eP +/- sz/2 deg drives the
% units at each cortical position: the overlap between the probe and a
% Gaussian receptive field (sd M.sigRF mm), raised to the exponent n.
if isinf(sz)
    sxn = ones(1, M.NX);            % full field
    return
end
lo = eP - sz/2;
hi = min(eP + sz/2, M.eMax + 1);
if lo <= 0
    xlo = -M.xOf(-lo);              % the probe crosses the fovea
else
    xlo = M.xOf(lo);
end
xhi = M.xOf(hi);
s   = 0.5 .* (erf((M.x - xlo) ./ (sqrt(2) * M.sigRF)) - erf((M.x - xhi) ./ (sqrt(2) * M.sigRF)));
s(s <= 1e-6) = 0;
sxn = s .^ M.P.n;
end


function col = probe_column(M, cond, eP, sz)
% PROBE_COLUMN  Everything about the cortical column at the probe centre that
% does not depend on the probe's SF or contrast.
%   col.G   1 x NF. The density- and attention-weighted spatial drive that
%           reaches this column's suppressive pool from its neighbours:
%           G(f) = sum over x' of Kx(x - x') * Sx(x')^n * w(x',f) * A(x',f)
sxn = spatial_drive(M, eP, sz);
ix  = min(max(round(M.xOf(eP) / M.dx), 0), M.NX - 1) + 1;   % nearest column
h   = (numel(M.Kx) - 1) / 2;
idx = ix + (-h:h);
idx(idx < 1) = 2 - idx(idx < 1);      % mirror across the fovea
ok  = idx <= M.NX;                    % nothing beyond the simulated field
A   = M.A.(cond);
wts = M.Kx(ok) .* sxn(idx(ok));
col.G  = wts * (M.w(idx(ok), :) .* A(idx(ok), :));
col.ix = ix;                          % column index
col.sx = sxn(ix);                     % spatial drive at this column
col.A  = A(ix, :);                    % attention gain of this column's units
col.wv = M.wv(ix, :);                 % voxel weights of this column's units
end


function u = drive_units(M, col, f, bw)
% DRIVE_UNITS  Describe each unit in the column for a probe of spatial
% frequency f (cpd) and bandwidth bw (octaves), independent of contrast.
%
% Both the stimulus drive and the suppressive drive scale with c^n, so every
% unit is an exact Naka-Rushton function of contrast:
%
%     r_k(c) = num_k * c^n / ( alpha_k * c^n + sigma^n )
%
%   u.num     1 x NF, voxel weight x attention gain x drive at unit contrast
%   u.alpha   1 x NF, suppressive drive at unit contrast (calibrated)
%   u.t       1 x NF, feature drive ^ n at unit contrast, before any weighting
P  = M.P;
sd = sqrt(P.sigT^2 + bw^2);                 % unit tuning convolved with the stimulus band
z  = (M.lf - log2(f)) ./ sd;
t  = ((P.sigT / sd) .* exp(-0.5 .* z.^2)) .^ P.n;   % feature drive ^ n at contrast 1
t(abs(z) > 4.5) = 0;
u.alpha = conv(t .* col.G, M.Kf, 'same') ./ M.sRef; % pool over SF
u.num   = col.wv .* col.A .* col.sx .* t .* M.dlf;
u.t     = t;

% Starting point for the Naka-Rushton fit: the c50 of the average driven unit.
if sum(u.num) > 0
    aBar = sum(u.num .* u.alpha) / sum(u.num);
    u.c50Start = P.sigma / max(aBar, 1e-9)^(1 / P.n);
else
    u.c50Start = P.sigma;
end
end


function r = pooled_response(M, u, c)
% POOLED_RESPONSE  Voxel response at each contrast in c: the weighted sum of
% the column's units. Returns a row vector the size of c.
cn = c(:) .^ M.P.n;                                               % nC x 1
r  = sum((cn * u.num) ./ (cn * u.alpha + M.P.sigma^M.P.n), 2).';
end


function [c50, rmax, n] = fit_naka_rushton(c, r, c50Start, nStart)
% FIT_NAKA_RUSHTON  Least-squares fit of r(c) = Rmax * c^n / (c^n + c50^n).
% Rmax enters linearly, so it is solved in closed form inside the objective
% and the search (fminsearch) runs only over log(c50) and log(n).
if max(r) <= 0
    c50 = NaN;  rmax = NaN;  n = NaN;
    return
end
y    = r ./ max(r);
opts = optimset('TolX', 1e-9, 'TolFun', 1e-14, 'MaxIter', 2000, 'MaxFunEvals', 4000, 'Display', 'off');
q    = fminsearch(@(q) naka_rushton_sse(q, c, y), [log(c50Start), log(nStart)], opts);
[~, rm] = naka_rushton_sse(q, c, y);
c50  = exp(q(1));
n    = exp(q(2));
rmax = rm * max(r);
end


function [sse, rmax] = naka_rushton_sse(q, c, y)
% Sum of squared errors for q = [log(c50), log(n)], with the best Rmax.
g    = 1 ./ (1 + (exp(q(1)) ./ c) .^ exp(q(2)));   % Naka-Rushton with Rmax = 1
rmax = sum(g .* y) / sum(g .* g);
sse  = sum((y - rmax .* g) .^ 2);
end


function D = simulate_psft_design(P, contrast)
% SIMULATE_PSFT_DESIGN  Predicted pSFT changes for the design of Ramirez,
% Wang & Ling (2025): attended 0.5 or 2 cpd, pSFT measured across 0.16 to
% 9.8 deg in the other hemifield. See section 6 of the main function.
ecc = linspace(0.16, 9.8, 32);              % voxel pRF eccentricities (deg)
sfs = 0.1 .* 120 .^ ((0:39) ./ 39);          % 40 pSFT stimuli, 0.1 to 12 cpd
attSF  = [0.5 2];
labels = {'lsf', 'hsf'};
P0 = P;  P0.fAtt = attSF(1);
M0 = build_model(P0);
% baseline (fixation) tuning of each voxel
base = zeros(numel(ecc), 3);                 % [peak (cpd), fwhm (octaves), amplitude]
for i = 1:numel(ecc)
    base(i, :) = voxel_psft(M0, 'none', ecc(i), sfs, contrast);
end
D.ecc = ecc;  D.sfs = sfs;  D.contrast = contrast;  D.eAtt = P.eAtt;
D.basePeak = base(:, 1).';  D.baseFwhm = base(:, 2).';
names = struct('stim', 'Stimulus-based', 'cort', 'Cortical-based');
for a = 1:2
    Pa = P;  Pa.fAtt = attSF(a);
    if a == 1, Ma = M0; else, Ma = build_model(Pa); end
    for cond = {'stim', 'cort'}
        c = cond{1};
        fit = zeros(numel(ecc), 3);
        for i = 1:numel(ecc)
            fit(i, :) = voxel_psft(Ma, c, ecc(i), sfs, contrast);
        end
        r.label      = sprintf('%s, attend %g cpd', names.(c), attSF(a));
        r.attendedSF = attSF(a);
        r.peakChange = 100 .* (fit(:, 1).' ./ D.basePeak - 1);    % percent change in peak
        r.bwChange   = 100 .* (fit(:, 2).' ./ D.baseFwhm - 1);    % percent change in bandwidth
        r.dist       = log2(D.basePeak ./ attSF(a));              % octaves from the attended SF
        r.ridge      = ridge_sf(Pa, c, ecc);                      % centre of the attention field (cpd)
        r.meanPeakChange = mean(r.peakChange);
        r.meanBwChange   = mean(r.bwChange);
        q = polyfit(r.dist, r.peakChange, 1);  r.slopeDist = q(1);   % % per octave
        q = polyfit(ecc, r.peakChange, 1);     r.slopeEcc  = q(1);   % % per degree
        D.([c '_' labels{a}]) = r;
    end
end
end


function out = voxel_psft(M, cond, e, sfs, contrast)
% VOXEL_PSFT  Fitted SF tuning of the voxel at eccentricity e: its response
% to full-field narrowband stimuli at each SF in sfs, fitted with a
% log-Gaussian. Returns [peak (cpd), fwhm (octaves), amplitude].
col = probe_column(M, cond, e, Inf);
y   = zeros(size(sfs));
for k = 1:numel(sfs)
    y(k) = pooled_response(M, drive_units(M, col, sfs(k), 0), contrast);
end
[mu, s, amp] = fit_log_gaussian(log2(sfs), y);
out = [2^mu, 2 * sqrt(2 * log(2)) * s, amp];
end


function [mu, s, amp] = fit_log_gaussian(x, y)
% FIT_LOG_GAUSSIAN  Least-squares fit of y = amp * exp(-(x - mu)^2 / (2 s^2)),
% x in log2 cpd. The amplitude is solved in closed form; fminsearch runs over
% mu and log(s), starting from the peak sample and the half-max width.
[ymax, ip] = max(y);
yn  = y ./ ymax;
lo  = x(find(yn(1:ip) < 0.5, 1, 'last') + 1);    if isempty(lo), lo = x(1); end
hi  = x(ip - 1 + find(yn(ip:end) < 0.5, 1, 'first') - 1);  if isempty(hi), hi = x(end); end
q0  = [x(ip), log(max((hi - lo) / 2.3548, 0.2))];
opts = optimset('TolX', 1e-10, 'TolFun', 1e-14, 'MaxIter', 4000, 'MaxFunEvals', 8000, 'Display', 'off');
q   = fminsearch(@(q) log_gaussian_sse(q, x, yn), q0, opts);
[~, A] = log_gaussian_sse(q, x, yn);
mu  = q(1);  s = exp(q(2));  amp = A * ymax;
end


function [sse, A] = log_gaussian_sse(q, x, y)
g   = exp(-0.5 .* ((x - q(1)) ./ exp(q(2))) .^ 2);
A   = sum(g .* y) / sum(g .* g);
sse = sum((y - A .* g) .^ 2);
end


function E = attention_effects(c50, rmax, resp)
% ATTENTION_EFFECTS  Percent effects of attention relative to the 'none'
% condition. Inputs have conditions along the first dimension
% (1 none, 2 stim, 3 cort); outputs keep the other dimensions, with
% index 1 = stimulus-based and index 2 = cortical-based.
sz = size(c50);
c50  = reshape(c50,  3, []);
rmax = reshape(rmax, 3, []);
resp = reshape(resp, 3, []);
E.c50  = reshape(100 .* (1 - c50(2:3, :) ./ c50(1, :)),  [2, sz(2:end)]);   % reduction in c50
E.rmax = reshape(100 .* (rmax(2:3, :) ./ rmax(1, :) - 1), [2, sz(2:end)]);  % increase in Rmax
E.resp = reshape(100 .* (resp(2:3, :) ./ resp(1, :) - 1), [2, sz(2:end)]);  % increase in response
end


%% =========================================================================
%%                                 PLOTTING
%% =========================================================================

function plot_summary(out, measure, hasMap)
P = out.P;  M = out.model;  probe = out.probe;
colNone = [0.54 0.56 0.61];  colStim = [0.38 0.31 0.84];  colCort = [0.92 0.41 0.20];
cols    = [colNone; colStim; colCort];
labels  = struct('c50', 'c50 reduction (%)', 'rmax', 'Rmax increase (%)', 'resp', 'response increase (%)');
sfTicks = [0.125 0.25 0.5 1 2 4 8 16];
titles  = {'Stimulus-based', 'Cortical-based'};
fields  = {'stim', 'cort'};
greys   = flipud(gray(256));

figure('Color', 'w', 'Name', 'FBA normalization: stimulus- vs cortical-based attention');

% ---- Attention fields over the neural image
for k = 1:2
    ax = subplot(2, 3, k);
    pcolor(M.ecc, 2.^M.lf, M.A.(fields{k}).');  shading flat;  hold on
    set(ax, 'YScale', 'log', 'YTick', sfTicks, 'Layer', 'top');
    ylim([0.125 16]);  xlim([0 12]);  colormap(ax, greys);
    if P.gain > 1, caxis([1 P.gain]); end
    plot(M.ecc, ridge_sf(P, fields{k}, M.ecc), 'k-', 'LineWidth', 1.5);            % gain ridge
    plot(M.ecc, 1 ./ (P.a .* M.ecc + P.b), 'k:', 'LineWidth', 1);                  % preferred SF
    plot(P.eAtt, P.fAtt, 'ko', 'MarkerSize', 9, 'MarkerFaceColor', 'w');           % attended grating
    plot(probe.ecc, probe.sf, 'kd', 'MarkerSize', 8, 'MarkerFaceColor', 'w');      % probe
    xlabel('Eccentricity (deg)');  ylabel('Preferred SF (cpd)');
    title([titles{k} ': attention field']);
end

% ---- Contrast response at the probe: samples and Naka-Rushton fits
subplot(2, 3, 3);
cFine = logspace(-2, 0, 100);
for ic = 1:3          % fitted curves first, so the legend picks them up in this order
    fitted = out.rmax(ic) .* cFine.^out.nfit(ic) ./ (cFine.^out.nfit(ic) + out.c50(ic)^out.nfit(ic));
    semilogx(100 .* cFine, fitted, '-', 'Color', cols(ic, :), 'LineWidth', 1.5);  hold on
end
for ic = 1:3          % then the simulated measurements, kept out of the legend
    semilogx(100 .* out.contrasts, out.crf(ic, :), 'o', 'Color', cols(ic, :), ...
        'MarkerFaceColor', cols(ic, :), 'MarkerSize', 4, 'HandleVisibility', 'off');
end
set(gca, 'XTick', [1 3 10 30 100]);  xlim([0.9 110]);
xlabel('Probe contrast (%)');  ylabel('Pooled response (a.u.)');
title(sprintf('CRF at the probe (%.2f cpd, %.1f deg)', probe.sf, probe.ecc));
legend({'No attention', 'Stimulus-based', 'Cortical-based'}, 'Location', 'northwest');

% ---- Attention effect across probe SF at the probe eccentricity
subplot(2, 3, 4);
E = out.tuning.effect.(measure);
semilogx(out.tuning.sf, E(1, :), '-', 'Color', colStim, 'LineWidth', 1.5);  hold on
semilogx(out.tuning.sf, E(2, :), '-', 'Color', colCort, 'LineWidth', 1.5);
yl = ylim;
plot([P.fAtt P.fAtt], yl, 'k--');                                   % attended SF
fr = ridge_sf(P, 'cort', probe.ecc);
plot([fr fr], yl, 'k:');                                            % rescaled SF
set(gca, 'XTick', sfTicks);  xlim([0.125 16]);  ylim(yl);
xlabel('Probe SF (cpd)');  ylabel(labels.(measure));
title(sprintf('Attention effect at %.1f deg', probe.ecc));
legend({'Stimulus-based', 'Cortical-based', 'attended SF', 'rescaled SF'}, 'Location', 'best');

% ---- Attention effect over probe eccentricity x SF
if hasMap
    Em   = out.map.effect.(measure);                 % 2 x nEcc x nSF
    lim  = max(1, max(abs(Em(:))));
    half = linspace(0, 1, 128).';
    bwr  = [half, half, ones(128, 1); ones(128, 1), flipud(half), flipud(half)];   % blue-white-red
    for k = 1:2
        ax = subplot(2, 3, 4 + k);
        pcolor(out.map.ecc, out.map.sf, squeeze(Em(k, :, :)).');  shading interp;  hold on
        set(ax, 'YScale', 'log', 'YTick', sfTicks, 'Layer', 'top');
        ylim([0.125 16]);  xlim([0 12]);  colormap(ax, bwr);  caxis([-lim lim]);  colorbar;
        plot(M.ecc, ridge_sf(P, fields{k}, M.ecc), 'k-', 'LineWidth', 1.5);
        plot(M.ecc, 1 ./ (P.a .* M.ecc + P.b), 'k:', 'LineWidth', 1);
        plot(P.eAtt, P.fAtt, 'ko', 'MarkerSize', 9, 'MarkerFaceColor', 'w');
        xlabel('Probe eccentricity (deg)');  ylabel('Probe SF (cpd)');
        title([titles{k} ': ' labels.(measure)]);
    end
end
end
`;
  }

  // Minimal ZIP writer (one stored file), for hosts that only accept .zip downloads.
  var CRC = null;
  function crc32(bytes) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zipBytes(name, text) {
    var enc = new TextEncoder(), data = enc.encode(text), nm = enc.encode(name), d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var crc = crc32(data), n = data.length;
    var out = new Uint8Array(30 + nm.length + n + 46 + nm.length + 22), v = new DataView(out.buffer), o = 0;
    v.setUint32(o, 0x04034b50, true); v.setUint16(o + 4, 20, true); v.setUint16(o + 6, 0x0800, true); v.setUint16(o + 8, 0, true);
    v.setUint16(o + 10, time, true); v.setUint16(o + 12, date, true); v.setUint32(o + 14, crc, true);
    v.setUint32(o + 18, n, true); v.setUint32(o + 22, n, true); v.setUint16(o + 26, nm.length, true); v.setUint16(o + 28, 0, true);
    out.set(nm, o + 30); out.set(data, o + 30 + nm.length);
    var cdStart = 30 + nm.length + n; o = cdStart;
    v.setUint32(o, 0x02014b50, true); v.setUint16(o + 4, 20, true); v.setUint16(o + 6, 20, true); v.setUint16(o + 8, 0x0800, true); v.setUint16(o + 10, 0, true);
    v.setUint16(o + 12, time, true); v.setUint16(o + 14, date, true); v.setUint32(o + 16, crc, true);
    v.setUint32(o + 20, n, true); v.setUint32(o + 24, n, true); v.setUint16(o + 28, nm.length, true);
    v.setUint32(o + 42, 0, true); out.set(nm, o + 46);
    var cdLen = 46 + nm.length; o = cdStart + cdLen;
    v.setUint32(o, 0x06054b50, true); v.setUint16(o + 8, 1, true); v.setUint16(o + 10, 1, true);
    v.setUint32(o + 12, cdLen, true); v.setUint32(o + 16, cdStart, true);
    return out;
  }

  return { matlab: matlab, zipBytes: zipBytes, FILE_NAME: 'fba_normalization_sim.m' };
});
