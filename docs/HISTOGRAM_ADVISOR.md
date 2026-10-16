# Local Histogram advisor

The first advisor supports **recorded, known-unmasked HistogramTransformation**
steps. It compares exactly one Histogram stage on a new prepared input, not an
entire adaptive chain. No network service, API key, Python runtime or additional
installation is required.

## Shared training folder (recommended)

In the initial PixInsight report dialog, click **Training folder...** and choose
an existing local folder. This setting is remembered by PixInsight. The folder
contains `AstroProcessAtlas_histogram_library.json` and one `.bak` recovery copy.
**Disconnect folder** forgets the setting; it does not delete training data.

- New reports add usable recorded Histogram examples to the shared library and
  embed the updated library as a portable snapshot.
- Trials exported by this version read the latest shared library directly in PixInsight and merge
  the report's examples before fitting a fresh model. An older HTML therefore
  does not force an outdated model when its newly exported trial is executed.
- Completed evaluations save to the common library automatically, merging existing
  records and preserving newer evaluations. Failed writes keep the trial pending.
- In an already open HTML, expand **Local training data** and choose **Load shared
  training folder** to refresh that report's snapshot, then save the HTML.
  Browsers, including Firefox, require an explicit folder/file selection; a local
  HTML cannot silently read an arbitrary filesystem path. Existing file imports
  remain available if directory selection is unavailable.

The folder path stays in PixInsight Settings; it is not embedded in public HTML.
The learning data itself is embedded, just like manually imported training data.
Regenerate older HTML reports to obtain this upgraded exporter; existing files
retain their embedded code. Without a configured folder, evaluation JSON
export/import works as before.
To carry over earlier evaluations, import their JSON in the HTML; the next trial
saved with a configured folder merges those examples into the shared library.

## Filter, composition and camera context

Acquisition identity is separate from the image ID. New report captures inspect
available current FITS `FILTER`/`FILTNAME` and `INSTRUME`/`CAMERA` keywords and
present XISF filter/camera properties. Origin ImageIntegration/FastIntegration
input tables are parsed as data, never executed: enabled image paths are counted
once, disabled entries and drizzle/normalization columns are excluded. Recognized
`FILTER-...` paths and specific filename patterns can yield Ha, SII, OIII, R, G,
B or L and camera hints such as ATR585M. Full path consensus is distinguished
from actual metadata. Original exposure files are not opened automatically.

The report displays the identity, camera, evidence source/confidence and input
agreement counts. Recognized recorded combination links can form a filter set;
possible edges, missing parents and masks do not establish a complete composition.
Inherited single-filter metadata is not blindly applied to a recorded RGB
combination. RGB without provenance remains unknown, not automatically broadband.
Custom/unrecognized filter labels and contradictions stay uncertain. Name-only
hints never constrain model matching.

Historical training examples and new trial feedback retain this context. Known
filter/composition matches are preferred; examples of another known type are
excluded. If no typed matches exist, untyped legacy examples may be used with an
explicit fallback reason. A matching known camera multiplies neighbour weight by
1.25; a different camera does not block a match. Global/regional numeric features
and the distribution-distance gate still apply. Filter sets describe inputs, not
a guaranteed exact palette assignment or sensor-response model.

In the trial input dialog, detection uses the **actual selected input's** metadata
and history, not the recorded target name. The optional **Input filter / composition**
selector can correct/confirm Ha/SII/OIII/R/G/B/L or RGB broadband/narrowband sets.
Choosing a correction is stored as `source: user`, `confidence: confirmed`;
leaving Automatic preserves detection provenance. Unknown is always available.
The selection is saved with the pending trial and final evaluation.

Old evaluations remain valid and are not relabelled from their image names.
Importing older modern HTML can recover types from recorded Origin inputs where
present; absent metadata and uncertain compositions cannot be reconstructed as
facts. Typed historical IDs remain distinct from legacy untyped seeds, and user
preferences are retained. New reports are needed to collect current FITS/XISF
metadata that was not captured in old HTML.

## Regional measurements

New captures reuse the existing uniform sample grid (up to 4096 raw pixels per
channel), divide it into **4 x 4 regions** and record each region's sample count,
mean, median, MAD, standard deviation and clipping fractions. There is no second
pixel sampling pass. Images too small for 16 populated regions keep global data.

The learner combines global features with the 10th/50th/90th percentiles of
regional medians, MAD, spread and clipping. It compares distributions of region
characteristics rather than fixed tile coordinates, reducing sensitivity to
rotation or position. This distinguishes some images with identical global
histograms, but does not recognize objects or measure aesthetic quality.

Old libraries/evaluations remain usable. A global model is retained for all
examples; a regional model uses only examples with regional measurements. When
regional data is missing, prediction uses global features. Regenerate reports
from the PixInsight workspace to capture regions for historical steps; absent
measurements cannot be recovered from an old HTML alone.

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
8. With a configured shared folder, the evaluation is saved there automatically.
   Otherwise, save the evaluation JSON. Cancelling keeps the trial pending. Discarding the
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
library also lives in the saved HTML's project.histogramLearning. The optional shared folder synchronizes through PixInsight; there is no
background upload. Imports are capped at 150 MB,
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

Downloaded trials include local training helpers to refresh their model from the
shared library. Historical HTML import remains in the browser interface. All
generated native code uses uniform LF line endings for PixInsight preprocessing.

The before/after statistics and three outcomes are retained for future model
evaluation; this first predictor learns selected parameter matrices from before-state
features, not a full visual objective or a guaranteed after-state target. There is
no quality score, no claim of improvement and no automatic replay replacement.
Use the three-way comparison to decide.

## Verification limits

Automated tests cover model fitting/preferences, ties/rejections, imported state,
native runtime mocks for pause/resume and cleanup, and generated-script syntax.
A headless browser checks download, feedback import, applying accepted values and
single-file save and shared-folder selection. Native PixInsight smoke checks cover
full-source compilation, RGB regional prediction and shared-library read/write.
Preference quality and preview layout still need testing with real images.
