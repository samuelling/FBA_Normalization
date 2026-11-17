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

Only the attention field `A` differs between the two models. Both fields are
spatially global and pass through the attended grating.

The measurement is the population contrast response at an ignored probe: a
weighted sum of the units at the probe's cortical location (a voxel), sampled at nine
contrasts (1 to 100%) and fitted with a Naka-Rushton function. Attention effects are
reported as the change in the estimated c50 (contrast gain), Rmax (response gain),
or the response at the probe contrast.

The voxel's weights are a band in SF centred on the local preferred SF (`sigVox`),
set separately from the spread of preferred SFs that feeds the suppressive pool
(`sigPop`). With the two equal, the voxel reads out the population that normalizes
it and attention appears as contrast gain in both models. With a narrower voxel
band, Rmax changes too, with opposite sign in the two models away from the attended
eccentricity.

## Files

- `model.js` - the model and the Naka-Rushton fit. No DOM; also loads in node
  (`const F = require('./model.js'); const m = F.create({gain: 2});`).
- `app.js` - controls, plots and maps.
- `index.html` - page and styles.

## Defaults

- M(e) = 17.3 / (e + 0.75) mm/deg (Horton & Hoyt, 1991)
- Preferred period = 0.12 e + 0.35 deg (Broderick, Simoncelli & Winawer, 2022)
- sigma is scaled so that a full-field grating at the locally preferred spatial
  frequency has an unattended c50 equal to sigma.
