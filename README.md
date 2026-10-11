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
