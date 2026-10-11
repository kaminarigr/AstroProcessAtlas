# Changelog

## Unreleased

- For a range starting with new-image PixelMath using only explicit image inputs,
  replace the separate target selector with an editable output name. Select actual
  references once before processing and derive the working image from the first
  reference. Preserve target selection for target/mask dependencies and handle
  output-name validation/collisions.

- Support standalone PixelMath replay with per-step selection/remapping of explicit
  image inputs, including symbol definitions. Preserve native expressions/settings
  and distinguish image identifiers from functions, locals, numbers and comments.
  Continue on new-image outputs with replay naming; support recorded masks and
  stop on cancellation/failure. Add EN/EL guidance and native/browser mock checks.
  Quoted/dynamic strings, directives, previews, global placeholders and cache-only
  operations remain blocked; native PixInsight validation is required.

- Support native Invert replay (pixel-value/color inversion), including prompted
  historical masks and their independent Mask > Invert Mask setting. Keep the
  source image unchanged and stop on unavailable/failed processes.

- Support GAME with empty Script parameters as a manual prepared-mask starting
  point. Show an orange warning, select/copy an existing grayscale GAME mask and
  apply following steps without modifying the input. Block GAME in the middle
  of a selected range. Do not claim automatic reconstruction of drawing settings.
  Include EN/EL report guidance and native/browser regression checks.

- Add SelectiveColorCorrection step identifiers and view-target dispatch to replay
  exports, so identified History Explorer calls apply only that operation instead
  of reopening the full workflow. Reject missing/invalid identifiers. Native
  history parameter capture remains to be validated in PixInsight.

- Execute only the installed Script for grouped SelectiveColorCorrection replay.
  Keep its two RGBWorkingSpace entries visible as report components without
  executing them separately; the script handles its working-space settings.

- Add a standalone numerical replay-difference diagnostic for original/replay
  checkpoints before and after a process. Report per-channel maximum/mean absolute
  differences using unclipped, unscaled 64-bit outputs without modifying inputs.

- Support serialized MultiscaleLinearTransform replay. Support DarkStructureEnhance
  as an interactive step using its installed algorithm, preserving attribution and
  GPL v3 in combined exports. Prompt for original settings because history records
  none, enforce the replay-copy target, fingerprint source and stop on cancellation,
  source changes or failure. Mark manual settings with orange WARNING. Native
  PixInsight validation remains required.

- Reopen the mask picker at every masked replay step, allowing different image
  versions and Color invert overrides. Preselect previous choices for that mask
  name and show the step number/title and available timestamp. Timestamps provide
  context, not proof of the mask pixel version.

- Replace mask confirmation with an editable Color invert checkbox in the mask
  picker. Default to recorded inversion, cache the user's choice, and apply later
  historical inversion changes relative to it. Continue works for either setting.

- Suggest matching original/base-channel images in PerfectPalettePicker input
  dropdowns, ignoring case and common processing suffixes. Remove the separate
  mask inversion dialog; recorded value inversion remains automatic and missing
  inversion uses normal values with report/console warnings.

- Fix first-use inverted replay masks: always select normal mask pixels and apply
  the recorded Mask > Invert Mask flag directly, rather than assuming the supplied
  image was physically inverted. Clarify black/white value inversion (1-mask), add
  console diagnostics, and verify Curves mask blending with a numeric model for
  both normal and inverted first use. Native PixInsight verification remains needed.

- Treat a recorded native mask with unspecified inversion as an interactive
  warning instead of blocking export. Ask for its historical orientation at the
  affected step without requesting the cached mask image again. Show masked
  replay entries in orange with WARNING; actual unsupported steps remain red.

- Support UnsharpMask replay with its recorded native parameters. For supported
  native processes, request recorded masks at first use, cache choices by historical
  name, and apply relative inversion automatically without changing mask pixels.
  Require explicit confirmation of the first requested orientation, clear masks
  between steps and stop with a retained partial result on cancellation/failure.
  Unknown mask orientation and externally masked grouped scripts remain blockers.

- Disable replay download when any selected step is blocked, including palette
  operations selected after the start of a range. Prevent direct export from
  bypassing this check. Color supported steps green and unsupported steps pink/red.

- Avoid recursive native Script execution for SelectiveColorCorrection. Include
  the installed Toolbox source inside an isolated function and supply a local
  view-target Parameters adapter. Fingerprint the source with SHA-256 at report
  generation and verify it before execution; original workspace history is no
  longer required. Native Script construction/execution is never used.

- Fix read-only Script property warnings during SelectiveColorCorrection replay.
  Resolve an existing immutable Script instance from open-image initial/recent
  history by exact saved parameters and checksum instead of constructing/writing
  a new Script. Stop explicitly when the original history is unavailable or differs.

- Replay SelectiveColorCorrection through its installed native Script instance,
  preserving complete saved settings and checksum. Run one parent operation on the
  replay result, regenerating internal masks/RGBWS. Block imported/historical masks,
  incomplete parameters and invalid serialization; require StarXTerminator when its
  internally generated star mask is enabled. Other scripts remain unsupported.

- Fix linear PerfectPalettePicker replay by requiring an explicit state for each
  selected input. Optionally apply blackpoint normalization and a median-0.25
  transfer to private channel copies before combination; bypass preparation for
  already prepared inputs, reuse shared copies and close temporary images on success
  or failure. Retain original inputs and any partial RGB result.

- Support NarrowbandNormalization with complete recorded parameters. Use the selected
  starting image when first, or the existing replay result (including a palette RGB
  result) when intermediate; preserve historical mask/reference and failure checks.

- Replay the recorded final PerfectPalettePicker arithmetic PixelMath combination
  as one parent step, with explicit prepared grayscale input selection in PixInsight,
  matching-dimension checks, new RGB output and subsequent supported steps. Require
  this operation at the range start; missing/unsupported serialization, formulas,
  symbols or masks remain blockers. Earlier channel preparation is not reconstructed.

- Export one parent replay entry for every grouped operation, including
  PerfectPalettePicker. Exclude all component steps and their replay-copy buttons;
  unsupported parents remain explicit blockers with the report's top-level numbers.

- Group the two matching RGBWorkingSpace entries immediately before
  SelectiveColorCorrection as its component steps. Keep parameters/thumbnails and
  consistent tree/detail numbering; omit these internal entries from replay while
  retaining the parent script as an unsupported blocker. Leave other RGBWS intact.

- Support StarXTerminator replay with either stars flag and original parameters.
  Allow its optional output references while retaining mask/input checks; continue
  subsequent processes on the starless copy even when the stars window is active.

- Handle ImageIdentifier as naming metadata at replay-copy creation. Use the last
  valid identifier in the selected range plus `_APA_replay`, or the selected input
  ID with that suffix when absent. Preview the base name, resolve collisions with
  numeric suffixes and keep input/existing image IDs unchanged.

- Support GradientCorrection replay with the complete serialized parameters,
  including diagnostic model/protection outputs; keep subsequent execution on the
  replay image copy and retain mask/reference/serialization checks.
- Clarify that unsupported processes are not yet supported by the replay exporter.

- Show StarXTerminator only on the source after a selected `_stars` output passes
  the existing enabled-output/name/history checks and receives its output link.
  Omit its corroborating output-origin entry from the stars tree/details/summary
  and replay, while preserving later operations, original live indices and proof
  for repeated report generation. Keep history intact when the link is unavailable.

- Treat initial ImageIntegration entries as image-origin metadata rather than
  replay processes; keep later integration operations as explicit blockers.
- Remove only the identical applied initial prefix from named `_clone`/`_cloneN`
  images when their source image is included. Compare native process parameters
  and recorded mask settings, preserve subsequent/redo steps and real live indices,
  and link the clone to the shared source history. Apply this consistently to the
  tree, details, summary, thumbnails and replay export.

- Construct replay comment and URL delimiters at runtime to avoid PixInsight
  preprocessing errors in the workflow generator's source strings.

- Add experimental per-image workflow `.js` export with consecutive process ranges,
  readiness checks, original parameters and applied-only step/substep numbering.
- Generated PixInsight scripts request and confirm the input state, create a new
  image copy with RGBWS/STF, and retain partial results when blocked or failed.
- Support eight native processes; block scripts, PixelMath,
  integrations, references, recorded/unknown masks and historical global RGBWS.
  Never silently skip unsupported steps or treat speculative links as replay evidence.

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
