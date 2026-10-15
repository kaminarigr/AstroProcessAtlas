# Help and feedback

AstroProcessAtlas by **YoruHikari**:
[website](https://www.yoruhikari.gr/) ·
[source code](https://github.com/kaminarigr/AstroProcessAtlas) ·
[ways to contribute](CONTRIBUTING.md).

Use the **About** dialog in PixInsight or the links at the bottom of a newly
generated HTML report to report a problem or suggest an improvement.

Before reporting:

1. Note the version shown in About and your PixInsight version.
2. For report interactions, generate a fresh HTML with the current script and
   note your browser/version. Saved reports keep the interface they were generated with.
3. For replay, generate a fresh replay script. Note the last image, task and tool.
4. Copy the exact error and a short sequence that reproduces it.

The chain outcome report can be saved as text. The console also prints the path
to `AstroProcessAtlas_chain_trace_….txt` in the system temporary directory.
If execution stops without a final message, the last trace lines can identify
whether it stopped inside a process or during cleanup.

Review excerpts before posting: image names, local file paths and processing
details may be private. Share the smallest useful example. Do not upload an
entire report or original images unless you intend to make them public.

Support is provided through public issues as time permits. Opening a link does
not automatically submit anything.

## Following a report

New submissions through the bug/proposal forms default to assigning the
maintainer. Use **Subscribe** on an issue to follow it, and enable the notification
channels you want in GitHub. When a fix is released, the maintainer can post its
version and release link and close the issue as completed. A committed fix may
still be awaiting publication. See the [issue management guide](docs/ISSUE_MANAGEMENT.md).

## Ελληνικά

Για αναφορά προβλήματος χρησιμοποίησε το **About** ή τους συνδέσμους στο footer
του νέου report. Γράψε εκδόσεις AstroProcessAtlas/PixInsight, browser όπου αφορά,
βήματα αναπαραγωγής και ακριβές σφάλμα. Σε αποτυχία replay κράτησε την τελευταία
εργασία και λίγες γραμμές από το report ή το αρχείο trace.

Έλεγξε το περιεχόμενο πριν το δημοσιεύσεις: τα issues είναι δημόσια. Δεν χρειάζεται
να κοινοποιήσεις όλο το HTML ή τις αρχικές εικόνες για μια πρώτη αναφορά.


Για να παρακολουθείς την εξέλιξη μιας αναφοράς, επίλεξε **Subscribe** στο issue.
Όταν κυκλοφορήσει η διόρθωση, αναφέρουμε την έκδοση και τον σύνδεσμο release και
κλείνουμε το issue ως Completed. Οι ειδοποιήσεις εξαρτώνται από τις ρυθμίσεις σου
στο GitHub. Μια διόρθωση στο Git δεν σημαίνει ότι έχει ήδη δημοσιευτεί αναβάθμιση.
