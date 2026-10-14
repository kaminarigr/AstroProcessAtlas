# AstroProcessAtlas

Visual processing history for PixInsight, by **YoruHikari**.

Explore the available processing history of your open images, their parameters, masks and image references in an interactive HTML report. Trace your work from selected original channels to the final image.

## Example report

Download [AstroProcessAtlas-demo.html](examples/AstroProcessAtlas-demo.html) and open it locally in Firefox, Chrome or Edge. It is a self-contained example from a real processing session (approximately 36 MB, including full process data); no thumbnail folder is needed.

For a direct download, use the file's **Download raw file** button on GitHub. GitHub's source view does not run the interactive report.

The embedded previews are reduced to at most 640 pixels and compressed for a smaller download. Full-resolution processing images are not included. The original report is preserved separately.

### Παράδειγμα report

Κατέβασε το [δείγμα HTML](examples/AstroProcessAtlas-demo.html) με το **Download raw file** και άνοιξέ το στον browser. Προέρχεται από πραγματική επεξεργασία και λειτουργεί ως ένα αρχείο. Τα thumbnails έχουν μικρύνει και συμπιεστεί για την επίδειξη· από το **Language / Γλώσσα** μπορείς να επιλέξεις Ελληνικά.

## Features

- Multi-image history graph with search, tool filters and synchronized image selection.
- Before/after previews and arbitrary stage comparison with shared zoom, synchronized A/B selectors and tree drag/drop.
- Search/jump to tree nodes, collapse image branches and show the upstream path to an image.
- Grayscale/color badges and connected-first image ordering.
- Readable HistogramTransformation and CurvesTransformation parameters and supported PixelMath equivalents.
- Historical mask information and previews of currently available masks.
- Clickable recorded, parameter-based, manual and explicitly unconfirmed connection details.
- Browser persistence and portable JSON export/import for manual connections.
- StarXTerminator stars-output links supported by output naming and history.
- Processing summary, explicit original-input selection and final-image preview.
- Copy process code with replay requirements.
- A standalone HTML report with embedded thumbnails, or HTML plus a thumbnail folder.
- English interface in PixInsight; English and Greek in the HTML report.

## Download and run

1. Download the release ZIP (recommended), or download [AstroProcessAtlas.js](https://github.com/kaminarigr/AstroProcessAtlas/blob/main/AstroProcessAtlas.js) and [AstroProcessAtlas.svg](https://github.com/kaminarigr/AstroProcessAtlas/blob/main/AstroProcessAtlas.svg) into the same folder. The SVG is the PixInsight feature icon.
2. Open the script in PixInsight's Script Editor and run it with your images open.
3. Select the images to include. Explicitly select the actual original inputs; images reopened after external editing are not automatically originals.
4. Leave **Single HTML file (embed thumbnails)** enabled for a portable report.
5. Save the report and open it in a browser. If embedding is disabled, keep the HTML and its `_thumbs` folder together.

## Updates

Current version: **0.2.0**. The version is shown in About.

Version 0.2.0 adds workflow replay with interactive image/mask selection, expanded
process support and consistent grouped-step numbering. See the [changelog](CHANGELOG.md)
for the release changes and the workflow replay section below for supported cases.

Version tags build downloadable ZIPs and draft GitHub releases automatically. Publishing a stable release deploys an **unsigned PixInsight update repository** to GitHub Pages. No CPD identity is required; users must allow unsigned repositories and scripts in PixInsight's Security preferences.

The PixInsight update URL is `https://www.yoruhikari.gr/pixinsight/astro-process-atlas/`. Use the `www` hostname to avoid HTTP redirects rejected by the PixInsight updater. GitHub Pages remains the publishing origin; existing installations can keep its URL, but register only one URL for this script. Add it through **Resources → Updates → Manage Repositories**, check for updates and accept the unsigned-repository confirmation. The feed targets PixInsight 1.9.3–1.9.4. See [release and repository setup](docs/RELEASING.md).

See [CHANGELOG.md](CHANGELOG.md) for changes.

## What the report can recover

Recovery depends on the history and pixels available through PixInsight. Closed images, historical mask pixels and unrecorded script inputs may be unavailable. Mask thumbnails show current mask contents. Before/after comparisons are omitted when historical pixels are missing or dimensions change.

Connected images appear first and disconnected images last, preserving the existing originals/dependency order within each group; this is not an absolute timeline. Possible connections for PerfectPalettePicker are clearly marked as unconfirmed. Its consecutive component entries can be presented as one group while preserving all underlying records.

Replay code requires the correct preceding image state, references and mask settings. It does not recover missing historical image versions.

## Workflow replay

New reports include **Export workflow for replay**. Select one image
and a consecutive range of applied processes, inspect the readiness list, and
download a `.js` file. Open it in PixInsight's Script Editor and run it with the
required input image already open. Select an image containing the pixels **before
the first selected process**, then confirm that starting state. The script creates
a new image copy, preserves its RGB working space and STF, and applies the original
serialized process parameters. It never changes the selected input.

For a suspected replay discrepancy, run `tools/diagnose_replay_difference.js` in
PixInsight with original/replay checkpoint copies before and after the process.
It creates 64-bit `abs(original-replay)` images without rescaling/clipping and
prints maximum/mean absolute differences per nominal channel. Input images remain
unchanged. Auto STF makes small residuals visible but does not measure their size;
an existing nonzero input difference can be amplified by a later process. This
diagnostic does not establish the cause or guarantee identical tool versions.

PerfectPalettePicker channel dropdowns suggest matching user-selected original
images, or base channel names such as Sii for SII_final, ignoring case and common
processing suffixes. Suggestions remain editable.

Workflow replay supports native HistogramTransformation,
CurvesTransformation, RGBWorkingSpace, SCNR, ColorSaturation, BlurXTerminator,
NoiseXTerminator, GradientCorrection, StarXTerminator, NarrowbandNormalization,
UnsharpMask, MultiscaleLinearTransform and Invert instances with supported serialization and no
historical input references. StarXTerminator output references are allowed.
RGBWorkingSpace steps that use historical global settings are blocked.
Required tools, licenses and matching models must already be available in PixInsight.
This does not guarantee identical pixels across tool/model versions.

Scripts outside the supported adapters, integrations, image combinations and unsupported output-generating processes,
unknown historical mask states and externally masked grouped scripts are currently blockers. The report
shows the runnable prefix; the replay dialog states where execution will stop.
Execution stops at that blocker or a process failure, preserves the partial result,
and does not skip ahead. A later range can be replayed only when you supply its own
correct starting image. Grouped processes export one parent entry with the report step number;
redo entries are excluded. Manual or possible graph links do not authorize replay.

For supported native processes with a recorded mask name and inversion state,
replay asks during preflight to select an open mask image for each use with
matching dimensions. Choose **Color invert (black/white mask values)** in the
same dialog when the selected mask needs value inversion for this step. The
checkbox defaults to the recorded inversion, or off when it is unspecified.
Continue is available with either setting; there is no confirmation checkbox.
During preflight the picker opens for every masked step, showing its number/title and
available recorded timestamp. The last selected image and Color invert choice
are preselected; recorded inversion changes adjust the default. Both can be
changed for each step, since the same mask name does not identify a pixel version.
Inversion means a weight of 1-mask at the same pixel coordinates, not a geometric
flip. Choices are cached by historical mask name for this replay run, and
inversion uses PixInsight's mask inversion flag.
Mask pixels are never changed. Masks are removed between operations. Cancellation
during preflight stops replay without creating a copy. Execution failures retain
the partial result. The report cannot reconstruct a mask's
historical pixels. Download is enabled only when the entire selected range is supported;
supported entries are green, mask prompts orange with WARNING, and blockers pink/red.
If the mask name is recorded but its inversion is unspecified, download remains
available and replay uses your Color invert choice, with a warning in the report
and console. There is no separate inversion-selection dialog. The mask image selection is still reused. An entirely unknown mask state
remains a blocker.
Timestamps can help compare a target step with a mask's Invert/Blur history, but
are not proof of its pixel version: times can be missing or inherited, and the
history does not link the target operation to an exact mask-history position.
Historical pixels, masks and missing inputs are not bundled in the exported script.

Standalone PixelMath replay preserves the serialized expressions and processing
settings, including single or separate channel expressions, symbols, rescaling,
truncation and working precision. `$T` refers to the current replay result. For
explicit image identifiers in active expressions or symbol definitions, a dialog
opens during preflight to select open images at their original processing state. It
suggests matching IDs and reuses previous choices as defaults; each selection can
be changed. References to the report image suggest the current replay result.
Different image names are supported. Function names, local/symbol declarations,
numbers, comments and target/mask placeholders are not remapped as image inputs.

Recorded `createNewImage` operations use a collision-free temporary output ID;
that new image becomes the current replay result with the existing replay name,
and subsequent steps run on it. Only the superseded replay copy is closed.
When the range starts with a new-image PixelMath expression using explicit image
references and no target/mask dependency, the initial dialog asks for an editable
output name instead of a separate target input. It defaults to the recorded
`newImageId` plus `_APA_replay` (or the selected naming metadata). Choose the
referenced images next; the first selected reference supplies the working
geometry/sample format where the recorded settings inherit those from a target.
Expressions using `$T`, masks or implicit no-argument functions retain the target
input selector. A name collision adds a numeric suffix without replacing images.
Selected input images remain unchanged. Recorded masks use the existing picker.
Missing inputs/processes, cancellation or process failure stop the workflow.
Quoted strings, directives, preview references, implicit global image placeholders
such as `$A`, and cache-only/no-output operations remain blocked. `$M`/`$mask`
require a recorded mask. Native PixInsight validation of this support is required.

Invert replay uses the native PixInsight process to invert pixel values (color or
grayscale), without changing image geometry. It runs on the replay copy. Recorded
masks use the same per-step picker and Color invert controls as other native
processes; this mask setting is independent of the Invert operation itself.

DarkStructureEnhance is supported as an interactive replay step using the installed
`scripts/misc/DarkStructureEnhance.js` algorithm. Its Script history has no saved
settings, so the report shows an orange WARNING and the original settings dialog
opens during replay. Re-enter the original settings; defaults are not recovered
historical settings. The selected target must remain the replay copy. Cancellation,
source changes or failure stop the workflow and retain the partial result. External
masking and unknown serialized parameter variants remain blocked. The adapted
installed source is embedded in this export, with its original attribution and
full GPL v3 license. Replay exports containing it are GPL-3.0-only; AstroProcessAtlas
itself remains MIT. No recursive native Script execution is used. Native PixInsight
testing of this new support is still required.

The two replay modes open from icon tiles above the tree. Search and filters are
immediately above the tree toolbar. Zoom, Edit tree, Save and Reset are grouped
there. Save stays disabled until workflow settings, steps, connections or change
history differ from the last exported report. **Reset unsaved changes** restores
that saved state (or the original report before the first save), after confirmation.
Browser caching is separate from saving an HTML file. Step deletion also requires
confirmation.

### Edit and save a replay workflow

Use **×** on a process tile to delete it from the tree and detailed history.
Enable **Edit tree** to drag a tile into another branch: an insertion line shows
the position, and dropping copies its parameters. Comparison drag-and-drop remains
available when Edit tree is off. Self-image PixelMath references are remapped to
the destination branch; review external references and masks.

Inside **Replay linked dependency chain → Edit replay workflow**, choose an image
and remove a step, or select a step from another image and its insertion position.
For example, copy the recorded GradientCorrection from Ha into Sii and Oiii before
their first processing step. Parameters and adapters are preserved. **Undo last
edit** restores the preceding workflow; check input preparation and references
again afterwards. Checkpoints are remapped as steps are added/removed. Removing
a stars producer blocks a branch that still needs that stars output.

Edits update the tree, detailed step list, summary and replay exports. Original
source records remain embedded for undo and the timestamped **Change history**.
Existing previews continue to document the original processing. No new preview is fabricated
for a copied step. Review references, masks and source checkpoints before export.
Changes are cached in browser storage when available. **Save edited report (HTML)**
downloads one self-contained report with embedded JSON for the workflow edits,
input bindings, starting-image suggestions, target, manual connections and change
history. **Save report (HTML)** is also available beside the tree and connection
controls; separate connection JSON export/import controls are no longer needed. Open
that downloaded HTML to restore them; no separate JSON file is required. Saving
creates a new download rather than overwriting the report currently open.

### Replay a linked dependency chain

Generate a new report, open **Replay linked dependency chain**, and select the final
image. Review each referenced image and its checkpoint (before processing or after
a particular step), palette input preparation and mask Color invert. Name matches
such as `SII_final` → `Sii` are suggestions requiring review. Confirm the plan and
download one chain script to run in PixInsight. **Original starting inputs** lists
all required originals, including channels without an initial PixelMath input.
Optional starting-image IDs suggest the native selection; you can choose differently
named open images there. Recorded ImageIdentifier names suggest channel aliases
and name the replay copies with `_APA_replay`; downstream steps use those copies.

The script processes the required channel branches in dependency order, combines
them and continues on the final image. Verified clones start at their recorded
parent checkpoint: `Ha_clone` can be rebuilt from the processed `Ha` and used as a
mask without selecting a separate mask file. Recognized StarXTerminator stars
outputs are reused automatically. Earlier checkpoints are preserved when a later
branch needs them; original input images remain unchanged. Convolution and safe
ProcessContainer groups of supported native steps are now supported.

Supply the original starting images and prepared GAME masks. GAME drawings and
unrecorded settings cannot be recovered. Unsupported steps, missing references or
cyclic dependencies block export. Manual links alone do not establish an exact
historical input. The plan needs explicit source checkpoints rather than assuming
that the current source image matches every earlier use. Full-resolution copies
for branches/checkpoints consume memory independently of the report preview size.
Temporary palette copies close after use; checkpoint copies close after their
last consumer or when the chain stops. Branch results and partial output are kept.
The chain shows live task progress and retains partial results on failure. Its
savable outcome report includes active step metadata, selected checkpoint routing,
image formats, execution trace, elapsed time and error stack for troubleshooting. Native
PixInsight validation is still required; automated tests exercise the planner,
exported script and simulated process execution.

GAME is supported as a **manual prepared-mask starting point**, not automatic
mask generation. Valid GAME Script entries with empty saved parameters show an
orange WARNING. Start the selected replay range at GAME, open the completed
original grayscale mask in PixInsight, and select it in the replay dialog. Confirm
that it contains the pixels immediately after GAME and before any later edits.
Replay copies this mask and applies the subsequent supported steps to the copy;
the selected mask is unchanged. A range containing GAME after other steps is
blocked: restart the range at GAME instead. Color inputs are excluded.

The Script history does not contain the drawn shapes or output-style choices.
This implementation does not invoke the GAME editor, reconstruct figures from
image properties/FITS keywords, or infer an original mask from a subsequently
processed mask. If the original mask is unavailable, create/select a suitable
mask manually; fidelity then depends on that supplied mask. Native PixInsight
validation is still required.

GradientCorrection preserves its original serialized thresholds, scale, convergence,
protection and model-generation settings. Diagnostic model/protection images may be
created when those flags were enabled; subsequent steps still run on the replay image
copy. Unknown mask states, historical references, invalid serialization and process
failures remain blockers. The report
labels unsupported tools as not yet supported by the exporter.

ImageIdentifier is handled as naming metadata at creation, without executing its
original rename operation. The last valid ImageIdentifier in the selected range
sets the copy's base name, followed by `_APA_replay` (for example `Ha_processed_APA_replay`).
Without one, the selected input image's current ID is used (`Ha_APA_replay`).
The native dialog previews the base name. Collisions receive `_1`, `_2`, etc.;
existing images and the input ID remain unchanged. Redo and out-of-range identifiers
are ignored. An empty/invalid recorded identifier remains an explicit blocker.

Initial ImageIntegration entries describe the provenance of an already integrated
input. They remain available in the report but are omitted from replay, so they do
not block the subsequent editing steps. An integration later in the editing history
still blocks replay.

When both `Image` and `Image_clone` (or a numbered `_cloneN`) are included, a common
consecutive initial prefix with identical processes, parameters and recorded mask
settings is shown only on the source image. The clone shows its subsequent steps
and an inferred link to that source history. This also affects summary counts and
replay export; replay of the clone starts from the state after the shared prefix.
The original PixInsight histories are unchanged. Missing sources, differing values
and redo entries are not deduplicated; naming and parameter matches do not prove
identical historical pixels.

After a StarXTerminator output link passes the existing `stars=true`, exact output
name and applied output-history checks, its corroborating origin entry is shown on
the source image rather than repeated on the `_stars` image. Subsequent stars-image
operations and their real history positions remain available in the tree, details,
summary and replay. Without that link, the output history remains visible. A later
StarXTerminator operation is retained, as is any process node required to explain
another selected output. The inferred link still does not establish exact historical pixels.

Before any processing starts, replay constructs and validates every selected
process, checks required script source fingerprints and star-mask dependencies,
and collects all PixelMath reference images and per-step mask choices. Palette
channels must be grayscale with matching dimensions. Masks must match the
anticipated target dimensions, and color masks require a color target. If a later
process is missing or a resource selection is cancelled, no replay copy or palette
stretch is created. Each mask version and Color invert choice can still differ
between steps; earlier choices are preselected. A current-result placeholder is
available for PixelMath references to the evolving replay result.

After completion or failure, a scrollable **Replay report** lists completed,
failed/cancelled and unexecuted steps, selected starting inputs, palette preparation,
PixelMath mappings, mask versions and Color invert, elapsed time and any retained
partial result. **Save report...** exports the same information as UTF-8 text;
the report is also printed in the PixInsight console. Preflight checks module and
resource availability, not license validity, AI model execution or mathematical
compatibility of arbitrary PixelMath expressions. DarkStructureEnhance settings
are still chosen at its execution step because its dialog needs the replay target.

Choose **Small / Normal / Detailed** in the PixInsight export dialog. All profiles
retain every history entry, parameter, connection and replay option; only preview
resolution changes. Maximum long-edge sizes are:

| Profile | Current image | Historical stages | Masks |
| --- | ---: | ---: | ---: |
| Small | 240 px | 480 px | 140 px |
| Normal (default) | 440 px | 800 px | 220 px |
| Detailed | 600 px | 1200 px | 300 px |

Small reports need less preview work and storage. Detailed keeps larger stage
previews for inspection. Float preview stretching now reads native image rows in
bulk instead of making a native call for each output pixel. Memory remains bounded
by the selected preview size and one source row; original data is unchanged.

Use **Compare original / replay...** in the initial PixInsight dialog, or
**Compare with original...** in a new replay's outcome report. Select matching
original/replay checkpoints with equal dimensions and color mode. The comparison
creates a collision-free 64-bit image containing `abs(original-replay)` without
rescaling or clipping, and displays maximum and mean absolute differences for
R/G/B or Gray. It also prints results to the console. Inputs, masks and STF remain
unchanged. Auto STF on the difference image can reveal small residuals; it does
not affect the numbers. A zero maximum means identical nominal-channel pixels
for the selected pair, not verification of every earlier workflow stage.

During replay a modeless **Replay progress** window lists every selected step.
Statuses move through Waiting, Loading inputs/masks, Ready, Running and Completed;
completed entries become green and failed/cancelled entries red. The header shows
the active tool and completed count. **Stop after current step** prevents the next
operation from starting and retains the partial result. Native processes may block
the event loop while running; the panel marks the active operation before execution
and does not invent internal percentages or an ETA.

Numerical comparison results now include original/replay thumbnails using the same
display transform, an amplified absolute-difference preview, and a channel table
with average/peak deviations as percentages of the normalized unit range alongside
the exact values. These percentages are not similarity scores. The newly created
difference image receives a display STF when appropriate; original pixels and STF
are unchanged. GAME-created masks are explicitly shown as **GAME mask — stretched**,
including inherited clone history, and are excluded from automatic linear-preview
stretching. This applies to report previews and identified GAME mask comparisons.

Each process now has a separate **Step data** badge: recorded process settings,
manual inputs/verification needed, or incomplete recorded data. It describes
available metadata, not replay support or proof of identical historical pixels.
Grouped tools show the most restrictive component status. Empty script settings,
unknown masks and historical references are explicitly distinguished.

Image headers and stage previews show brightness-based appearance estimates.
A recorded non-neutral HistogramTransformation midtones setting is separately
identified as nonlinear stretch in the history; this does not prove the final
pixel state. Dark images may be linear or simply dark nonlinear images. Dark
previews receive a linked RGB/grayscale blackpoint and midtones display stretch
on a bounded floating-point preview only. The same display transform is reused
for dark stages of one image; different image branches may use different display
transforms. Original pixels, STF, masks and history are unchanged. Mask thumbnails
retain their original values. Pure-black data and unavailable statistics are
reported without inventing content. These previews are visual aids, not numerical
comparisons of the original data.

Run `node test_workflow_replay.cjs` for the generator and simulated native execution
checks, alongside the existing history/report tests. Actual PixInsight execution
still requires validation with real images and installed processes.

## Ελληνικά

Το AstroProcessAtlas δημιουργεί διαδραστικό HTML με το διαθέσιμο ιστορικό επεξεργασίας των ανοιχτών εικόνων του PixInsight.

Κατέβασε το `AstroProcessAtlas.js`, άνοιξέ το στον Script Editor του PixInsight και εκτέλεσέ το. Επίλεξε τις εικόνες του report και όρισε ρητά τις πραγματικές αρχικές εικόνες. Η προεπιλεγμένη εξαγωγή ενσωματώνει τα thumbnails στο HTML. Από το **Language / Γλώσσα** επίλεξε **Ελληνικά**.

Μετά την πρώτη δημοσίευση στο GitHub Pages, οι ενημερώσεις διατίθενται και μέσω του PixInsight. Το αποθετήριο είναι unsigned: χρειάζονται οι επιλογές **Allow unsigned update repositories** και **Allow execution of unsigned scripts** στο **Preferences → Security**. Οδηγίες: [RELEASING.md](docs/RELEASING.md). Αναλυτικές οδηγίες του report: [WORKSPACE_HISTORY_README.md](WORKSPACE_HISTORY_README.md).

## Development

Run the regression checks with Node.js:

```sh
node test_history_report.cjs
node test_workspace_report.cjs
node test_preview_completeness.cjs
node test_numeric_comparison.cjs
node test_chain_replay.cjs
```

These checks mock the PixInsight APIs and browser DOM. They do not replace testing in PixInsight and a real browser.

## Author

**YoruHikari** — [YoruHikari Astrophotography](https://www.yoruhikari.gr/).

## License

Licensed under the [MIT License](LICENSE). You may use, modify and redistribute
the software, including commercially, while retaining the copyright and license
notice. The copyright notice includes **YoruHikari Astrophotography** and
**https://www.yoruhikari.gr/**. An acknowledgment and link in About or documentation
are appreciated; an additional visible credit is not a license requirement.

Διατίθεται με την άδεια **MIT**: επιτρέπεται χρήση, τροποποίηση και αναδιανομή,
με διατήρηση της άδειας και της αναφοράς δημιουργού, η οποία περιλαμβάνει το site.

## Stage comparison and manual connections

Open **Compare any two stages** below the tree. Choose A/B from the dropdowns,
drag tree nodes to the A/B areas, or drag one node onto another for immediate
comparison. A is the dragged node, B is the destination. Process nodes use their
after preview; image nodes use their current snapshot. Dropdowns and A/B tree
markers stay synchronized. Before previews can also be selected in the dropdown.
Only available previews are offered; missing historical pixels cannot be recovered.

Manual connections save automatically in browser storage when available. Export
JSON for a portable backup, and import it alongside the same report in another
browser. This does not rewrite the HTML. Clearing connections also clears their
saved state. Invalid imports leave existing connections intact.

## Connection details and large trees

Click a connection line (or focus it and press Enter) to inspect its origin,
source, destination, evidence and historical uncertainty. Manual and possible
connections remain clearly distinguished from recorded history.

Use **Organize tree** to find and jump to an image/process node, collapse the
steps of an image branch while retaining its image header, or show only the
selected image and the branches feeding it. Possible and manual connections
are included in that path; redo entries do not establish dependencies.
**Expand all branches** restores the complete tree. These controls change the
tree view only; process records remain available in the report.

StarXTerminator preserves its recorded parameters, including `stars`. With
`stars=true`, the native tool also creates a stars image; this output reference
does not block replay. Subsequent steps continue on the starless replay copy,
even if the stars window becomes active. The separate stars history is not replayed.

When two consecutive RGBWorkingSpace entries match the installed
SelectiveColorCorrection helper parameters and immediately precede that script
in the same history phase and applied/redo state, they appear as component steps
of one SelectiveColorCorrection group. Their parameters and thumbnails remain
available. These internal RGBWorkingSpace entries are omitted from workflow replay;
the parent executes through the installed script when complete settings and checksum are available. Different
settings, isolated entries and intervening operations remain independent steps.

All grouped operations, including PerfectPalettePicker, appear once in the replay
list. Component steps (including internal PixelMath or RGBWorkingSpace) remain
visible in the report but have no independent replay-copy control and are not
exported. Unsupported parent tools remain blockers; execution cannot bypass them.

PerfectPalettePicker replay supports its recorded final multi-channel arithmetic
PixelMath combination as one parent operation. Start the export range at that
step. In PixInsight select a grayscale image and its preparation state for each historical image
identifier displayed in the dialog; names may differ from the recorded names.
Dimensions must match. Replay creates a new RGB image named after the report image
(or selected ImageIdentifier) plus `_APA_replay`, then runs subsequent supported
steps on that result. Input images remain unchanged.

This repeats the captured final combination, not the original interactive script
or its earlier channel extraction and OSC preparation. Supply images at
that prepared state, or select the linear-input stretch. Missing final PixelMath, masks, single-expression mode,
custom symbols, alpha expressions or formulas beyond the supported arithmetic
remain blockers. Other grouped scripts besides the explicitly supported tools remain unsupported.

NarrowbandNormalization replay preserves the recorded native parameters. If it is
the first selected step, choose its starting image in the PixInsight replay dialog;
replay runs on a new copy. As an intermediate step it uses the existing replay
result, including a preceding PerfectPalettePicker RGB result, without a second
input selection. The installed module is required; unknown mask states/historical references
and invalid serialization remain blockers.

For PerfectPalettePicker, each input now requires an explicit preparation state:
**Already prepared** or **Linear - apply PPP stretch (median 0.25) on a copy**.
The linear option normalizes the blackpoint using the larger of the minimum and
median minus 2.7 standard deviations, then applies a midtones transfer targeting
median 0.25 before combination. It modifies temporary copies, not the selected
images, and closes those copies after execution or failure. Choose already
prepared for channels at the original combination state to avoid stretching twice.
This recovers the installed PPP linear-input preparation; other unrecorded steps
(including OSC extraction/averaging or an unidentified Script) are not inferred.

SelectiveColorCorrection replay includes the installed Toolbox source inside an
isolated function and supplies the complete saved parameter table through a local
view-target Parameters adapter. This avoids both read-only Script properties and
PixInsight's prohibition on recursive Script execution. It runs once per parent
operation on the current result, regenerating internal RGBWorkingSpace settings
and masks. No original image/history needs to remain open for this operation.

Replay exports set an `apaSelectiveStep` instance parameter before each
SelectiveColorCorrection operation. When launched on a view from History Explorer,
the replay file uses that identifier to apply only the recorded operation directly
to the target view, without opening the workflow dialog or making another copy.
The history file path still points to the exported replay file, which must remain
available. Entries from older exports with empty parameters cannot identify their
operation; new exports reject these view-target calls. Generate a new report and
replay to obtain the identifier. Native PixInsight history capture still needs
validation; automated checks cover parameter setup and view-target dispatch.

The replay file references the installed source by an absolute include path. The
source and its companion library must remain installed at that path; export a new
report on another installation. A SHA-256 fingerprint captured when generating
the report is checked before processing; regenerate the report/export if the tool
changes. The installed tool version must be suitable for the saved settings.
StarXTerminator is required with useStarMask. Imported Mask, incomplete settings,
historical masks/references and invalid serialization remain blockers. No native
Script instance is constructed or executed, and other scripts remain unsupported.
