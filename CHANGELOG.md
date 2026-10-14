# Changelog

## Unreleased

- Integrate numerical original/replay comparison in the main PixInsight dialog
  and replay outcome report, with 64-bit absolute difference images and per-channel
  maximum/mean statistics, preserving input images and display state.
- Add Small / Normal / Detailed report profiles with 480 / 800 / 1200 px stage
  previews and matching image/mask sizes; retain all history and parameters.
- Speed up dark preview stretching with native row reads instead of individual
  pixel calls, preserving the linked display transform and bounded memory.

- Add step/group data completeness badges, separate from replay eligibility,
  with tree indicators for recorded settings, manual inputs and missing metadata.
- Add estimated image appearance and recorded histogram stretch indicators.
  Render dark stages with linked display-only stretch on bounded float previews,
  reuse the transform within each image and preserve original pixels/STF/masks.

- Validate the full replay range before processing: process constructors, script
  fingerprints, dependencies, palette inputs and per-step PixelMath/mask choices.
  Check mask dimensions and color compatibility; cancelled selections and missing
  later tools no longer leave an unnecessarily processed partial image.
- Add a scrollable replay outcome report with step status, input/mask selections,
  Color invert, elapsed time, retained partial output and UTF-8 text export.

## 0.2.0 — 2026-10-11

- Add workflow replay export for a selected image and consecutive applied steps.
  Download a PixInsight script, review readiness and run on a new copy with the
  recorded native parameters. Unsupported selections disable download; failures
  stop execution and retain the partial result. Remove the experimental label.
- Support HistogramTransformation, CurvesTransformation, RGBWorkingSpace, SCNR,
  ColorSaturation, BlurXTerminator, NoiseXTerminator, GradientCorrection,
  StarXTerminator, NarrowbandNormalization, UnsharpMask, MultiscaleLinearTransform
  and Invert. Required modules, licenses/models and suitable input states must be
  available; historical global RGB working-space settings remain blockers.
- Support standalone PixelMath with per-step selection of referenced images,
  token-aware remapping in active expressions and Symbols, original settings,
  masks and continuation on new-image results. New-image entry points using only
  explicit references ask for an editable output name instead of a separate target.
  Quoted strings, directives, previews, implicit global references and cache-only
  operations remain unsupported.
- Replay the recorded PerfectPalettePicker arithmetic combination as one parent
  step. Select prepared grayscale channels, or apply the supported linear-input
  stretch to temporary copies. Suggest matching original/base channel names.
  Unrecorded channel preparation and historical input versions are not recovered.
- Replay SelectiveColorCorrection using its installed source and complete saved
  parameters, avoiding recursive Script execution and read-only Script properties.
  Verify the source fingerprint. Keep its two matching RGBWorkingSpace components
  in the report and let the script handle those settings. Add step identifiers and
  view-target dispatch for new replay history entries; native history capture needs
  confirmation. GUI-cached internal masks are not recorded in the original history
  and can cause differences from independently rerun Script instances.
- Support DarkStructureEnhance interactively with its installed algorithm and
  manually entered settings, since history records none. Keep the replay target,
  verify source and preserve attribution/full GPL v3 in combined replay exports.
  Support GAME as a manual starting point using a copy of its completed original
  grayscale mask; drawing geometry is not reconstructed from empty Script parameters.
- Request historical masks at every masked step. Suggest the previous selected
  image, allow Color invert overrides, and apply native Mask > Invert Mask without
  modifying mask pixels. Unknown inversion shows an orange warning; unknown mask
  state blocks replay. Available timestamps provide context, not mask-version proof.
- Handle ImageIdentifier as output naming metadata with the _APA_replay suffix and
  collision-safe numbering. Keep optional StarXTerminator stars outputs from
  redirecting later steps away from the starless result.
- Group parent operations consistently across tree, details and replay; preserve
  component details. Treat initial ImageIntegration as origin metadata. Collapse
  matching clone prefixes and corroborated stars-output origin steps while keeping
  later operations, real history indices and source connections.
- Show green readiness, orange manual-input warnings and red blockers; retain only
  each step's own number in the replay list. Add a numerical checkpoint diagnostic
  reporting per-channel maximum/mean absolute original-versus-replay differences.
- Update English/Greek report guidance, release documentation and package metadata.
  Regression and package checks complement native testing; identical pixels depend
  on original inputs, mask versions, internal script state and installed tool versions.

## 0.1.18 — 2026-10-11

- Inspect connection origin, endpoints, evidence and uncertainty by clicking a line.
- Add node search/jump, image branch collapse/expand and upstream path filtering
  for large workspace trees.

- Show a translucent copy of the dragged tree tile, dim its source and highlight
  the destination while selecting stages for comparison.

- Compare any two available stages with synchronized dropdowns, tree A/B markers
  and drag/drop into slots or onto another node.
- Automatically save manual connections in browser storage; preserve portable
  JSON export/import and reject invalid or mismatched imports.

- Place images without cross-image connections after connected images, preserving
  the existing order within each group.

- Link StarXTerminator stars output to its source step when stars=true, an exact
  `<source>_stars` image exists, and its applied history contains StarXTerminator.

- Show grayscale and color circle badges beside image names in the graph,
  based on the current image color mode.

- Fix single-file export when the same mask thumbnail is shared by multiple
  history steps or images. Embedded asset references are no longer opened as files.

## 0.1.7

- Reduce parameter previews from five entries/lines to one; remaining values stay
  available in collapsed details, including curve point tables.

## 0.1.6

- Show a native export progress bar with the current stage and image/step.
- Deduplicate byte-identical PNG files by SHA-256 when embedding thumbnails,
  including identical history states with different filenames. PNG pixels and
  preview resolution remain unchanged; savings depend on repeated images.

## 0.1.5

- Embed each unique thumbnail once and stream it directly to disk. Steps share
  compact references resolved by the report, reducing repeated base64 data and
  memory retained during export without reducing preview resolution.
- Avoid redundant history navigation and repeated attempts to capture failed states.
- Release the full-size rendered bitmap reference before saving its scaled preview.

## 0.1.4

- Show the first five entries of large parameter arrays, or five lines of multiline
  values, with the remaining data in collapsed details for all serialized processes,
  including FastIntegration targets/outputData and ImageIntegration.

## 0.1.3

- Add a vector feature icon showing three channels connected to a star. Include
  the icon beside the script in PixInsight installation packages.

## 0.1.2

- Stream workspace reports to disk by step instead of accumulating all images in
  one HTML string, avoiding allocation overflow for large embedded-thumbnail reports.
- Write UTF-8 in bounded chunks without splitting Unicode surrogate pairs.

## 0.1.1

- Include PixInsight 1.9.3 in the update repository's compatibility range. The
  previous 1.9.4-only manifest hid the package from users running 1.9.3.

## 0.1.0

Initial repository preparation under the AstroProcessAtlas name.

- Workspace history graph with explicit original inputs and connection provenance.
- Search, tool and mask filters, synchronized selection and tool highlighting.
- Before/after previews, shared zoom and standalone HTML export.
- Processing summary and copyable process code with replay requirements.
- Mask previews, readable transformation parameters and supported PixelMath equivalents.
- English/Greek report interface and versioned About dialog.
- Grouped PerfectPalettePicker entries with consistent step/substep numbering.
