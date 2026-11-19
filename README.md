# FBA Normalization

Interactive simulation of feature-based attention in the normalization model of
attention (Reynolds & Heeger, 2009), set up to pit two hypotheses against each other:

- **Stimulus-based**: attending a grating of a given cpd boosts units tuned to that
  same cpd at every eccentricity.
- **Cortical-based**: the boosted spatial frequency is rescaled with eccentricity,
  either with cortical magnification M(e) (constant cycles per mm of cortex) or with
  the local preferred spatial frequency p(e).

Open `index.html` in a browser (no build step, no dependencies), or serve the repo
with GitHub Pages.

## What it computes

The neural image is cortical distance along one meridian by preferred spatial
frequency. Receptive fields and the suppressive pool have a fixed size in mm of
cortex. For each condition (no attention, stimulus-based, cortical-based):

    R(x, f) = A(x, f) * E(x, f)^n / (S(x, f) + sigma^n)
    S       = suppressive kernel (*) [ density * A * E^n ]

Only the attention field `A` differs between the two models. The cortical field's rescaling can be
partial: ridge(e) = f_att x ratio(e)^k, where ratio(e) follows cortical magnification
or the local preferred SF, k = 0 is the stimulus-based model and k = 1 the full rule. Both fields are
spatially global and pass through the attended grating.

The measurement is the population contrast response at an ignored probe: a
weighted sum of the units at the probe's cortical location (a voxel), sampled at nine
contrasts (1 to 100%) and fitted with a Naka-Rushton function. Attention effects are
reported as the change in the estimated c50 (contrast gain), Rmax (response gain),
or the response at the probe contrast.

The voxel's weights are a band in SF centred on the local preferred SF. Its width
is solved at each eccentricity so that the model voxel's SF tuning (full-field
narrowband stimuli, 90% contrast) has the measured bandwidth: by default 3 octaves
FWHM at the fovea rising linearly to 4.3 at 9 deg, after Aghajari, Vinke & Ling
(2020). The resulting band (about 0.9 to 1.1 octaves sd) is narrower than the spread
of preferred SFs feeding the suppressive pool (`sigPop`, 1.5 octaves sd), so Rmax can
change a little with attention as well as c50.

## The 2025 pSFT design

A panel simulates the design of Ramirez, Wang & Ling (2025, J Neurosci): attend a letter
stream filtered around 0.5 or 2 cpd at 3.5 deg ("Use the 2025 settings" sets this up),
and measure each voxel's pSFT in the other hemifield from 0.16 to 9.8 deg with 40
full-field stimuli from 0.1 to 12 cpd, fitted with a log-Gaussian against a fixation
baseline. It reports, for each model and attended SF, the percent change in the pSFT peak
by eccentricity and by the voxel's octave distance from the attended SF, with the mean,
the slope against distance (negative = attraction), the slope against eccentricity and the
mean bandwidth change. The pSFT contrast is adjustable: the study's bandlimited noise was
100% Michelson contrast, which drives SF-tuned units less than a 100% grating.

## MATLAB export

The "MATLAB code" button writes the current simulation as one commented function
file, `fba_normalization_sim.m` (base MATLAB R2016b or later, no toolboxes; also
runs in GNU Octave). It is a port of `model.js` with the dashboard's settings filled
in, and returns the CRFs, Naka-Rushton estimates, SF tuning curves and
eccentricity x SF maps in a struct.

## Files

- `model.js` - the model and the Naka-Rushton fit. No DOM; also loads in node
  (`const F = require('./model.js'); const m = F.create({gain: 2});`).
- `export_matlab.js` - generates the MATLAB file.
- `app.js` - controls, plots and maps.
- `index.html` - page and styles.
- `bundle.js` - `node bundle.js` writes `standalone.html`, a single-file copy with the
  scripts inlined.

The script tags in `index.html` carry a `?v=` number. Bump it when a script changes,
so browsers do not pair a new page with a cached older script.

## Defaults

- M(e) = 17.3 / (e + 0.75) mm/deg (Horton & Hoyt, 1991)
- Preferred period = 0.12 e + 0.35 deg (Broderick, Simoncelli & Winawer, 2022)
- sigma is scaled so that a full-field grating at the locally preferred spatial
  frequency has an unattended c50 equal to sigma.
