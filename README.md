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

Current version: **0.1.18**. The version is shown in About.

Version tags build downloadable ZIPs and draft GitHub releases automatically. Publishing a stable release deploys an **unsigned PixInsight update repository** to GitHub Pages. No CPD identity is required; users must allow unsigned repositories and scripts in PixInsight's Security preferences.

The PixInsight update URL is `https://www.yoruhikari.gr/pixinsight/astro-process-atlas/`. Use the `www` hostname to avoid HTTP redirects rejected by the PixInsight updater. GitHub Pages remains the publishing origin; existing installations can keep its URL, but register only one URL for this script. Add it through **Resources → Updates → Manage Repositories**, check for updates and accept the unsigned-repository confirmation. The feed targets PixInsight 1.9.3–1.9.4. See [release and repository setup](docs/RELEASING.md).

See [CHANGELOG.md](CHANGELOG.md) for changes.

## What the report can recover

Recovery depends on the history and pixels available through PixInsight. Closed images, historical mask pixels and unrecorded script inputs may be unavailable. Mask thumbnails show current mask contents. Before/after comparisons are omitted when historical pixels are missing or dimensions change.

Connected images appear first and disconnected images last, preserving the existing originals/dependency order within each group; this is not an absolute timeline. Possible connections for PerfectPalettePicker are clearly marked as unconfirmed. Its consecutive component entries can be presented as one group while preserving all underlying records.

Replay code requires the correct preceding image state, references and mask settings. It does not recover missing historical image versions.

## Experimental workflow replay (development version)

New reports include **Export workflow for replay (experimental)**. Select one image
and a consecutive range of applied processes, inspect the readiness list, and
download a `.js` file. Open it in PixInsight's Script Editor and run it with the
required input image already open. Select an image containing the pixels **before
the first selected process**, then confirm that starting state. The script creates
a new image copy, preserves its RGB working space and STF, and applies the original
serialized process parameters. It never changes the selected input.

The first implementation supports independent, in-place HistogramTransformation,
CurvesTransformation, RGBWorkingSpace, SCNR, ColorSaturation, BlurXTerminator,
NoiseXTerminator, GradientCorrection, StarXTerminator and NarrowbandNormalization instances with supported serialization and no recorded mask or
historical input references. StarXTerminator output references are allowed.
RGBWorkingSpace steps that use historical global settings are blocked.
Required tools, licenses and matching models must already be available in PixInsight.
This does not guarantee identical pixels across tool/model versions.

Other scripts, standalone PixelMath, integrations, image combinations, unsupported output-generating processes,
masked steps and unknown historical mask states are currently blockers. The report
shows the runnable prefix; the replay dialog states where execution will stop.
Execution stops at that blocker or a process failure, preserves the partial result,
and does not skip ahead. A later range can be replayed only when you supply its own
correct starting image. Grouped processes export one parent entry with the report step number;
redo entries are excluded. Manual or possible graph links do not authorize replay.
Historical pixels, masks and missing inputs are not bundled in the exported script.

GradientCorrection preserves its original serialized thresholds, scale, convergence,
protection and model-generation settings. Diagnostic model/protection images may be
created when those flags were enabled; subsequent steps still run on the replay image
copy. Recorded/unknown masks, historical references, invalid serialization and process
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
remain blockers. Other grouped scripts besides SelectiveColorCorrection and standalone PixelMath remain unsupported.

NarrowbandNormalization replay preserves the recorded native parameters. If it is
the first selected step, choose its starting image in the PixInsight replay dialog;
replay runs on a new copy. As an intermediate step it uses the existing replay
result, including a preceding PerfectPalettePicker RGB result, without a second
input selection. The installed module is required; historical masks/references
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

SelectiveColorCorrection replay executes the installed Toolbox script directly
as a view-target Script instance, with its complete recorded parameter table and
script checksum. It runs once per grouped operation (or standalone instance), on
the current replay result, and regenerates its internal RGBWorkingSpace settings
and masks. No separate internal RGBWorkingSpace entries are exported. The installed
script and its dependencies must match the recorded settings/version; when
useStarMask is enabled StarXTerminator is required. Imported Mask is blocked because
its input view is not saved by the script, as are missing settings, checksums,
historical masks/references and invalid serialized process code. Other scripts
remain unsupported. Generate a new report and export to use this support.

SelectiveColorCorrection requires an original image with the recorded Script
instance to remain open. Native Script properties are read-only, so replay searches
open-image initial/recent processing histories for the saved call with matching
parameters and checksum, and executes that existing instance on the replay result.
It never assigns Script.filePath, md5sum, parameters or information. If no match is
available it stops and preserves any partial replay result. Keep the original
workspace/history open; exporting parameter text alone cannot recreate this native
Script instance. The original image and saved process settings remain unchanged.
