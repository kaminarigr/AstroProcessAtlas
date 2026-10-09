# Example report

`AstroProcessAtlas-demo.html` is a self-contained showcase exported from a real PixInsight processing session supplied by YoruHikari.

Its embedded images are reduced to at most 640 pixels, with opaque previews compressed as JPEG. The report's interactive controls and recorded process code are retained. Displayed file metadata uses filenames rather than local folder paths.

Open the downloaded HTML locally in a browser.

To prepare a similar copy from your own exported report, use Python with Pillow installed:

```sh
python tools/prepare_demo.py path/to/exported-report.html examples/AstroProcessAtlas-demo.html
```
