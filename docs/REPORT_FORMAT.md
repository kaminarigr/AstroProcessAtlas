# Report data format — schema 1

AstroProcessAtlas keeps a single, offline HTML report. Its captured data is
separate from the browser interface and can be read with a JSON parser without
running the report's JavaScript. This is the foundation for other viewers and
exporters. The browser print/PDF view consumes this model plus the current workflow
snapshot and readable HTML fragments; no separate project application is needed.

## Embedded documents

- `script#apa_report_data[type="application/json"]`: captured workspace and saved
  project state. The format marker is `AstroProcessAtlasReport`, `schemaVersion: 1`.
- `script#apa_report_assets[type="application/json"]`: optional shared preview
  map. Keys such as `#apa_asset_1` map to image data URIs. The script streams each
  image once, rather than adding image bytes to every step. Without embedded
  previews, references remain relative paths to the report's companion folder.
- The executable script contains the viewer and replay/export functions. It
  obtains its data by parsing these documents, not by evaluating their contents.

The schema version describes the stored format; it is independent of the script
version in `generator.version`. Unsupported schema versions produce a visible
error instead of loading a partially interpreted workflow.

## Main fields

| Field | Meaning |
| --- | --- |
| `format`, `schemaVersion` | Document identity and compatibility version. |
| `generator` | AstroProcessAtlas name and application version. |
| `createdAt` | UTC time of report creation. |
| `options` | Report-size profile and whether previews are embedded. |
| `workspace.images` | Original replay manifests: steps, recorded executable settings, inputs, origins, masks and supported/blocked status. |
| `workspace.graph` | Original nodes, connections, provenance and unresolved references. |
| `sources` | Shared recorded source pool, including unsupported steps and full history containers. |
| `history` | Captured image/step metadata, source keys, timestamps, history phases, references and preview keys. |
| `project` | Saved workflow edits, bindings, starting inputs, annotations and change history; `null` for a new report. |

`workspace` is the captured baseline. The interface works on copies. Editing,
deleting or skipping a step does not replace the captured data: the resulting
operations are saved in `project` in the same document. `project.version: 1` and
its fingerprint validation continue to use the existing workflow-state format.
Consumers can call `restoreReplayWorkflow(model.workspace.images, model.project)`
to apply authored operations; manual connections use the existing annotation
validation and replay-binding rules. A graph link does not establish an exact
historical pixel state.

## Recorded source pool and lazy details

Each history step/container has a `source` key such as `s12`. Its value in
`model.sources` is either:

- The recorded source string.
- `{ "image": 0, "step": 2 }`, referring to an identical source string already in
  `workspace.images[0].steps[2].source`.

Use `resolveAtlasReportSource(model, key)` rather than assuming all source values
are strings. Pool deduplication compares full text after hashing, so hash
collisions cannot substitute a different source. Sources are text, not evaluated
objects; no native PixInsight process/image objects are stored in this model.

Large full-code fields are empty `textarea[data-apa-source]` elements in the HTML.
The viewer fills their values when details open, or before Copy. Their source is
not duplicated back into markup when the edited HTML is saved. Readable tables
and plots remain rendered HTML; a future viewer may derive alternatives from the
recorded source and metadata. Unsupported replay steps remain unsupported even
though their recorded code is retained.

## Reading data

In the browser, the baseline can be inspected with:

```js
const model = JSON.parse(document.getElementById('apa_report_data').textContent);
const images = model.workspace.images;
```

The report's loader also validates image identities, step structure, graph
endpoints, source references and preview URI types. An external tool can extract
the same JSON script contents using an HTML parser, then parse JSON. It should
validate the format/schema before interpreting fields. Never execute extracted
source strings simply to read a report.

The JSON writer escapes HTML delimiters, so recorded strings containing
`</script>`, quotes, Unicode or paths cannot terminate a data block. Preview bytes
stay outside the main model. The HTML remains an executable interactive document;
open only reports you trust, and review private names/paths before publishing one.

## Save and compatibility

Save updates `project` inside `apa_report_data`; it does not require a JSON sidecar
or add a duplicate `apa_workflow_state` block. Reset restores the last saved
project state, and the original manifests remain unchanged.

Older reports keep their existing self-contained viewers. The new loader has a
legacy adapter for previously decoded graph/replay globals and the former
`apa_workflow_state` document. It does not silently execute or rewrite an older
HTML to obtain those globals. The legacy editing Save/restore path is retained.
Generate a fresh report to get the new model and source-loading behavior.

Future incompatible formats need an explicit schema migration. Unknown schema
versions must not be treated as legacy documents or overwritten by Save.


## Print view

The print builder selects either the whole current workflow or the tasks required
by the selected dependency plan. Captured source/preview metadata remain distinct
from edited choices. Readable table/plot fragments are cloned from the report,
interactive controls are removed, and a separate light A4 document is built.
Full recording includes origin metadata and marks redo entries as not applied.
Grouping preserves all recorded component details. Schema-1 `history.steps.origin`
is an additive metadata flag used to distinguish integration origins.

Printing does not write project edits or execution results back into the model.
Preview bytes are resolved from the shared asset map, and copied steps do not
pretend to have newly computed preview pixels. Browser print/Save as PDF provides
the PDF output; the editable standalone HTML remains the project document.


## Sampled image-state measurements

Schema 1 has optional additive statistics fields: `history[].statistics` describes
current pixels; `history[].steps[].statistics` contains `before`, `after` and the
corresponding live history indices. Missing historical states are `null`; a failed
measurement has `available: false` and `reason`. Legacy reports can omit these fields.
Measurements are captured before preview stretch and never alter replay sources.

Available measurements carry `version: 1`, `method: uniform-grid`, grid dimensions,
image dimensions/color metadata, `rawPixels: true`, `alphaExcluded: true` and
per-channel samples/invalid counts, mean, median, P01/P10/P90/P99, minimum/maximum,
population standard deviation, MAD and black/white fractions. Fractions use finite
sample counts, with thresholds <=0 and >=1; raw values are not clamped. Up to
64 × 64 deterministic grid samples are read per nominal channel. These are sample
estimates, not full-image histograms, localized mask statistics or noise estimates.
The viewer only shows deltas for matching dimensions and channel counts.


## Local Histogram learning

The optional project.histogramLearning field stores an
AstroProcessAtlasHistogramLibrary version-1 document with examples and
evaluations. Historical examples contain validated raw before/after statistics
and a five-row H matrix; preference examples come from explicitly accepted trial
outcomes. Evaluations contain recorded/suggested/user candidates, accepted IDs
(including ties or an empty rejection), optional reason and captured-step context.
No raster data, executable imported code or model-service credentials are stored.

The fitted model is separately embedded in a downloaded local trial script;
its format is AstroProcessAtlasHistogramModel, version 1, with feature
normalization and weighted-neighbour exemplars. Model IDs are informational
fingerprints, not cryptographic signatures. Trial state uses a per-script Settings
key with ASCII-hex JSON and owned view IDs. Runtime evaluations transfer through
AstroProcessAtlasHistogramFeedback version-1 JSON. Importing and saving the HTML
makes the transfer file optional thereafter. See [advisor details](HISTOGRAM_ADVISOR.md).

### Regional statistics and shared-library snapshots

Statistics schema version 1 optionally includes `channels[].regions`: 16 entries
in row-major 4 x 4 order, each with `samples`, `mean`, `median`, `mad`, `stddev`,
`blackFraction` and `whiteFraction`. Regional sample counts sum to the channel's
sample count. Regions are omitted for tiny grids or invalid samples. Validation
preserves regional measurements in training examples and evaluations.

Model version 1 retains global `gray`/`rgb` groups and optionally adds
`graySpatial`/`rgbSpatial`. Exemplars carry `featureVersion` 1 (global) or 2
(global plus regional distribution quantiles). Older models without that field
remain valid global models. Prediction selects a compatible feature group.

The optional report-level `histogramLearning` field seeds a new report from the
shared folder. Once edited/saved, `project.histogramLearning` takes precedence.
The shared-folder path is kept only in PixInsight Settings, not in the report.
The native trial includes a validated library snapshot, merges the latest shared
library at runtime and atomically replaces the shared JSON on evaluation save,
keeping one recovery `.bak`. No network or directory path inference is used.
