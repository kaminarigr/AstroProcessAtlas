# Local Histogram advisor

The first advisor supports **recorded, known-unmasked HistogramTransformation**
steps. It compares exactly one Histogram stage on a new prepared input, not an
entire adaptive chain. No network service, API key, Python runtime or additional
installation is required.

## Try it

1. Create a new AstroProcessAtlas report with recorded image statistics.
2. In the chain plan, click a HistogramTransformation step, choose **Customize
   parameters**, then **Compare three versions and learn locally**. The optional
   step editor's **Parameters** button reaches the same dialog.
3. Download the three-version trial. The current report supplies usable historical
   training examples automatically; save the edited HTML to retain that library.
4. Run the downloaded .js in PixInsight. Select a new grayscale/RGB image of the
   same type containing pixels **before this Histogram step**, then confirm.
5. The script creates **Recorded**, **Suggested** and **User** copies. The first
   two are processed. HistogramTransformation opens on User with the current
   workflow settings, without applying them, and the script finishes.
6. Adjust and apply HistogramTransformation **once** to User. You can undo and
   replace that application; two consecutive applications cannot be represented
   as one recorded Histogram matrix and are refused. Leaving User unchanged is
   allowed and represents an identity Histogram. Do not apply other tools/masks
   or edit Recorded/Suggested.
7. Inspect the full-resolution copies if desired. Run the **same downloaded file**
   again to open three small previews, all without STF. Choose Recorded,
   Suggested, User, a tie, all equal, or reject all. A reason is optional.
8. Save the evaluation JSON. Cancelling keeps the trial pending. Discarding the
   trial session removes its resume metadata; all result images remain open.
9. Import the evaluation in the HTML advisor. The learner updates locally.
   **Save report (HTML)** keeps training data and edit history in the same file.
   The JSON is a transfer file; it is not needed after import and HTML save.

If an accepted evaluation belongs to this exact recorded step, select an accepted
version and click **Use accepted result in this step** to update replay parameters.
Ties require you to select which accepted version to apply. No evaluation changes
the workflow automatically. Normal recorded-value restore still works.

Closed/renamed/replaced trial images cannot be resumed safely. Download a new trial
from the HTML if the originals are unavailable. Pending metadata is scoped to the
downloaded script. Successful save removes it; no temporary image files are created.
Trial ownership uses permanent view metadata so pixel processing and undo/redo do
not remove it. Updated trial runtimes can recover a missing marker from the first
implementation after validating all saved IDs, geometry and candidate histories.
A conflicting marker or changed candidate still stops evaluation.
Evaluation save retains result copies intentionally. Each run has its own trial ID,
even when the same downloaded script is used again.

## Training and portability

**Local training data** imports modern HTML reports containing inert versioned
capture data, a learning-library JSON, or evaluation JSON. Imported HTML is parsed
as data; its scripts are never executed. Older reports without statistics cannot
supply training examples. Masked/unknown-mask, redo, inaccessible, invalid or
geometry-changing examples are skipped. Only raw RGB/grayscale statistics and H
matrices are used; no raster images are placed in the learning library. Evaluations\nalso retain image identifiers, model ID and proposal/fallback provenance for audit.

Export a library JSON to transfer learning between reports/computers. The full
library also lives in the saved HTML's project.histogramLearning. There is no
automatic global collection or background upload. Imports are capped at 150 MB,
libraries at 2000 examples and 500 evaluations. Conflicting repeated IDs are
rejected; identical repeats are ignored.

This is an **instance-based supervised numerical learner**, not a neural model or
a language-model agent. Training fits feature normalization separately for RGB and
grayscale examples. Prediction retrieves up to four neighbours using per-channel
raw distribution features (including log median, quantiles, MAD and clipping
fractions), and computes a distance-weighted Histogram matrix. Explicit accepted
results carry greater weight than historical seeds; ties divide that preference
weight. Rejections are retained as evaluation records and do not become positive
training examples. They do not yet train a negative ranking model.

Historical H matrices are starting examples, not evidence of optimal processing.
Matching sampled statistics does not establish matching objects, structures or
aesthetic needs. Suggested can equal Recorded with sparse/no matching data. A
distance gate falls back to Recorded outside the learned distribution, explicitly.
Alpha settings are retained from Recorded, not predicted.

The before/after statistics and three outcomes are retained for future model
evaluation; this first predictor learns selected parameter matrices from before-state
features, not a full visual objective or a guaranteed after-state target. There is
no quality score, no claim of improvement and no automatic replay replacement.
Use the three-way comparison to decide.

## Verification limits

Automated tests cover model fitting/preferences, ties/rejections, imported state,
native runtime mocks for pause/resume and cleanup, and generated-script syntax.
A headless browser checks download, feedback import, applying accepted values and
single-file save. Actual PixInsight execution and preview layout still require
local testing with real images.
