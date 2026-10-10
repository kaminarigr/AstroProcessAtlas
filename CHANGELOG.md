# Changelog

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
