# Changelog

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
