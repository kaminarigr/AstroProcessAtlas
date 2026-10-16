# Changelog

## Unreleased

- Avoid literal comment delimiters in the structured-parameter parser regexes,
  preventing PixInsight preprocessing from truncating the script.

- Edit HistogramTransformation channel matrices and CurvesTransformation control
  points/interpolation in HTML. Add/remove intermediate curve points, show a
  control-point outline, validate numeric bounds and ordering, retain masks and
  other recorded settings, and save/replay or reset exact original sources.
  Show edited/added/removed points in Replay changes beside recorded tables.

- Show edited replay values beside recorded values in a Replay changes table
  column instead of inserting a separate panel beside the image. Remove the
  column when all parameters are restored.

- Edit supported recorded UnsharpMask, NoiseXTerminator and BlurXTerminator
  parameters in the report. Validate values, retain exact recorded defaults per
  step and restore them after save/reopen, mode changes or copying. Apply variants
  to both replay exports and show changes in the tree, plan and print view.
  Keep recorded preview pixels and history tables explicitly separate from edits.

## 0.4.0 — 2026-10-15

- Fix a PixInsight strict-mode warning in the print preview image-loading callback.

- Add browser-native PDF/print previews for the full recording and the selected
  linked dependency chain. Print only required branch checkpoints, include current
  workflow choices/edits and distinguish redo/origin metadata. Use an A4 light
  layout with contents, readable tables, grouped step components, Before/After
  previews, input/mask mappings and change history. Offer preview/parameter/table/
  source options, wait for images and retain the editable HTML unchanged.

- Separate the single-file report's captured workspace from its interface using
  an inert, versioned JSON document and a shared JSON preview store. Save authored
  edits/connections/history in the same document; retain the legacy state adapter.
  Keep the baseline isolated from UI changes and reject unknown schema versions.
- Retain complete recorded process/container sources in a shared pool, reuse
  identical replay source strings and load large code fields on detail expansion
  or Copy. Document the format for future viewers/exporters without sidecar files.

- Assign new bug/proposal form submissions to the maintainer by default. Add a PR
  template and issue-to-release guidance with changelog links, notification setup
  and resolution comments that distinguish committed fixes from published releases.

## 0.3.9 — 2026-10-15

- Support NarrowbandHueCombination replay from complete recorded settings: map
  up to three grayscale channels and optional RGB stars in standalone and chain
  replay, apply HSV/screen/SCNR and recorded amounts, and retain the source script's
  Generate behavior without its preview-only stretch. Produce a new 32-bit RGB
  result and release helpers on success/failure. Detect references in the tree;
  explain missing settings and block unknown parameters or external masks.

- Support native SpectrophotometricFluxCalibration, DynamicCrop and FastRotation
  replay. Preserve available metadata and astrometry on copies/checkpoints; defer
  standalone mask selection after geometry changes until the actual target exists.
- Support saved ImageBlend combinations through the installed CosmicPhotons engine:
  map base/blend inputs in standalone and chain replay, preserve supported recorded
  settings, verify installed source hashes and clean helper images on failure or
  completion. Detect image references and output aliases; block missing/unknown
  settings. Include the applicable GPL license and author attribution in exports.

- Resolve PixelMath input references through unique recorded image names from
  newImageId and ImageIdentifier, including weighted combinations whose inputs
  were renamed later. Use the same mapping in the tree, summary and chain replay;
  preserve exact-name priority and require selection for ambiguous aliases.

- Support ChannelCombination replay with recorded native color-space settings,
  enabled and Auto channels, new RGB creation and partial existing-target updates.
  Integrate standalone/chain input mapping, masks, manual adjustment and skip.
  New channel combinations retain the highest source sample precision.

- Support ColorCalibration, BackgroundNeutralization and LRGBCombination replay.
  Preserve recorded settings and ROIs; select calibration references (including
  previews in standalone replay) and remap channel/reference IDs to chain
  checkpoints. Support LRGB on existing RGB targets and new full-RGB combinations,
  enabled/Auto channels, weights, transfer functions and noise-reduction settings.
  Integrate references with masks, manual adjustment, skip and copied steps.

## 0.3.8 — 2026-10-15

- Escape SVG namespace URLs in tree editing and browser code to prevent
  PixInsight preprocessing from truncating functions at URL slash pairs.

- Make tree editing explicit with an amber canvas border and edit instructions.
  Show delete controls only in edit mode with pointer cursors. Dropping a tile
  onto another creates a manual connection; dropping between steps still copies.
  Reuse manual-link validation, persistence and replay routing; keep comparison
  dragging available outside edit mode.

- Encode resume metadata as ASCII hex with read-back verification, protecting
  strings containing newlines, paths and Unicode in PixInsight Settings. Recover
  legacy JSON with literal string control characters without clearing sessions.

- Guard optional image-window and resume metadata properties before reading
  them, avoiding strict PixInsight warnings while serializing ordinary objects.

- Escape slash characters in exported replay metadata so serialized table
  comments and URLs cannot truncate strings during PixInsight preprocessing.

- Reuse verified prepared input prefixes in standalone and chain replay. Compare
  complete recorded process settings against applied history, excluding redo,
  masks, manual modes and dependent/output-producing processes. Show reusable
  counts during input selection and mark reused tasks in progress/diagnostics.
  Recover required earlier live-history checkpoints without repeating processing,
  restore selected inputs even on failure, and block inaccessible inherited states.

- Change a processing step's execution mode directly from the chain review plan
  through an accessible modal. Show Auto in green, Adjust in PixInsight in amber
  and Skip in gray, with text labels and disabled unsupported choices.

- Add saved per-step execution modes: Automatic, Adjust in PixInsight and Skip.
  Native adjustment now ends script execution and keeps the working copy, mask
  and required checkpoints open. Run the same replay script again to resume,
  explicitly skip or discard; settings store continuation metadata without
  extra files. Validate saved checkpoint histories and geometry, preserve
  multiple pauses, record available adapted parameters and avoid double execution.
  Replace the nonmodal wait loop, which left native process controls blocked.
  Mark modes in the tree and plan; script adapters retain specialized handling.

## 0.3.2 — 2026-10-15

- Integrate manual connections into chain replay as input/mask checkpoints, branch
  origins and generated stars outputs, labelled manual in cards and diagnostics.
  Recompute on add/remove and restore saved links without extra confirmation.
  Block ambiguous roles, conflicts and cycles; do not invent missing parameters.

- Support manual stars-output links after the redundant stars origin
  entry has already been removed, leaving an empty history. Reuse the producer
  output without deleting another step or requiring a separate stars input.

- Escape URL slash pairs in concatenated report-footer and About strings to
  prevent PixInsight preprocessing from truncating them as line comments.

- Expand creator credits and the PixInsight About dialog; add feedback and
  contribution links to About and the bilingual report footer.
- Add public bug/feature issue forms, support and contribution guides. Include
  the guides in release packages while retaining validation of older packages.
  Encourage optional testing, documentation and sharing; no donation link or
  automatic report submission is added.

## 0.3.1 — 2026-10-15

- Treat initial FastIntegration history as integrated-image origin metadata, like
  ImageIntegration, without exporting it as a replay process.
- Restore explicit tree-to-detail navigation: clear conflicting filters, reveal
  hidden/collapsed parent sections and scroll to the selected process details.

## 0.3.0 — 2026-10-15

- Explain opaque PixelMath `image` copies directly in reference cards and offer
  source mapping, explicit no-op skip, GraXpert replacement or a prepared result.
  Persist skip choices, preserve step/checkpoint numbering, warn about omitted
  external processing and support both single and chain replay without guessing.

- Collapse optional starting-image name suggestions while retaining expansion
  during edits. Link plan blockers and task references to their exact input/mask
  cards with hover/focus highlighting and click/keyboard navigation.

- Center the chain target selector against its description, promote optional
  workflow editing to an icon tile, align full-width starting-input rows and
  clearly distinguish disabled chain downloads from enabled actions.

- Synchronize the step source selectors when the workflow image changes while
  keeping independent source selection available for copying between images.
- Make chain task columns adapt to available container width. Add accessible,
  dismissible English/Greek notifications for edits, copies and report downloads;
  exclude transient notifications from saved HTML.

- Group chain reference cards by the image using them. Add labelled input/mask
  SVG icons, matching color accents and separate step captions within each
  responsive group, with English/Greek labels.

- Reorganize chain replay into final-image selection, input review and download.
  Use responsive cards for connections and starting inputs, side-by-side workflow
  editing/configuration, visible source/stage/preparation labels and mobile-sized
  controls. Collapse optional advanced GraXpert settings and add English/Greek guidance.

- Collapse the PixelMath expression section by default and center tree delete
  icons. Replace browser deletion prompts with an English/Greek modal showing
  the image, step, tool, available mask/inputs and expandable parameters/code;
  support explicit confirmation, cancellation, Escape and keyboard focus handling.

- Preserve and deduplicate embedded replay modules' PJSR includes in the chain
  script header. Fix DarkStructureEnhance failing before its settings dialog with
  `FrameStyle_Box is not defined` (also retain TextAlign, ColorSpace and NumericControl).

- Persist a timestamped chain execution trace before/after every task and process,
  including cleanup boundaries and caught failure stacks. Print the diagnostic
  file path at startup and in the report so silent interruptions can be located.
  Guard final cleanup so cleanup errors do not suppress the completion report.

- Buffer GraXpert console output per stream, normalize line endings and separate
  glued timestamped records. Indent replay log sections, label stderr and mark
  truncated tails while preserving partial final lines on success and failure.

- Clean up process-created helper image windows after chain replay steps and on
  completion, failure or cancellation, retaining branch results and generated stars.
  Record closed windows and cleanup failures in chain diagnostics.
- Display the chain task plan in columns that adapt to available container width.
- Default new GraXpert declarations to smoothing 0.5, GPU and automatic latest
  available AI model; retain explicitly saved values, including zero smoothing.

- Discover GraXpert automatically from the installed wrapper's GraXpertPath.txt,
  resolve its bare command through PATH and check the standard Windows user
  installation before requesting an executable manually.

- Normalize quoted Windows GraXpert executable paths and reject shortcuts/scripts.
  Include launch executable, argument array, readable process-error descriptions
  and captured console output in replay failures, including failed-to-start code 0.

- Add explicit prepared-external checkpoints that skip earlier branch processing,
  preserve checkpoint references and resume single/chain replay from supplied pixels.
- Add user-configured GraXpert background-extraction CLI replay with correction,
  smoothing, optional AI model/device and executable selection during preflight.
  Validate output, log settings/errors and clean temporary images/files.
- Save external declarations in workflow operations, HTML and change history,
  allow original-step restoration and stop auto-binding opaque PixelMath `image`
  copies to their own raw input. Historical tool/settings remain unverified.

- Restore authored workflow edits only from embedded saved-HTML state. Stop
  reading/writing legacy workflow browser caches, so freshly generated reports
  retain their actual PixelMath/processing histories without stale modifications.

- Initialize mask/mapping resources for every replay step, including unmasked
  palette steps, avoiding undefined-array-property warnings in PixInsight.

- Avoid duplicate PixelMath input edges for the immediately preceding state of
  its own image branch; retain external, historical-checkpoint and mask links.

- Place search/filter controls immediately above the tree and group Zoom, Edit,
  Save and Reset in a responsive toolbar. Present both replay modes as icon tiles.
- Track unsaved report changes separately from browser caching; disable Save on
  clean state and reset edits/settings/connections to the last exported baseline.
- Require confirmation before removing a step from either tree or editor list.

- Add deletion directly on tree tiles and an Edit tree drag-copy mode with a
  visible insertion line between destination steps; preserve comparison mode.
- Update graph nodes/edges, detailed ordering, summary and counts with edits;
  remap direct self-image PixelMath references and preserve explicit checkpoints.
- Embed timestamped change history, including undo, save and manual connections,
  in the saved HTML. Replace separate connection JSON controls with common Save
  report (HTML), retaining original records for undo and original-only previews.

- Add a replay workflow editor with step removal, parameter-preserving copies
  between image branches, insertion position and undo. Remap dependency stages
  and block references to a removed stars producer.
- Apply edited workflows to replay exports while preserving original history,
  tree and previews. Cache changes locally when browser storage is available.
- Save one self-contained edited HTML with embedded, validated JSON for workflow
  operations, bindings, starting inputs, target and manual connections; restore
  it before initialization and preserve script-safe serialization.

- Resolve native chain targets/palette inputs by image ID instead of JavaScript
  wrapper identity, and detect new stars outputs by IDs.
- Add chain diagnostics with active step metadata, input formats, checkpoint
  routing, execution trace, elapsed time, error stack and remaining open images.

- Show every original chain input in the HTML, including channels without initial
  PixelMath references. Allow optional native starting-image ID suggestions.
- Resolve channel aliases from recorded ImageIdentifier values and name replay
  branches accordingly, keeping downstream bindings on generated copies.

- Close palette preparation copies after use and dependency-chain checkpoints
  after their last consumer, including cancellation/failure cleanup. Preserve
  original inputs, branch results and failed-step partial output.

- Export a reviewed dependency-chain replay with channel input mappings, explicit
  source checkpoints, palette preparation and mask Color invert choices.
- Rebuild verified clones and StarXTerminator stars branches automatically; retain
  earlier checkpoints and process only dependencies of the selected final image.
- Add safe native ProcessContainer and Convolution replay, whole-chain preflight,
  live task progress, saved lineage and a text outcome report. Require original
  starting images/prepared GAME masks; block unsupported or cyclic chains.

- Identify GAME mask history as stretched, including clones, and preserve raw
  mask previews instead of estimating them as linear dark images.
- Present original/replay/difference previews and a readable comparison table,
  with percent-of-unit-range deviations and exact statistics. Amplify only the
  difference display and preserve original image pixels/STF.
- Add a live replay task list with loading/running states, green completion,
  failure state, active-tool header and stop-after-current-step support.

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
