"""Create a smaller, self-contained showcase copy of an exported report."""
import argparse
import base64
import hashlib
import io
import re
from pathlib import Path

from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('destination', type=Path)
args = parser.parse_args()
text = args.source.read_text(encoding='utf-8-sig')
cache = {}
count = [0]

def compact(match):
    encoded = match.group(1)
    key = hashlib.sha256(encoded.encode('ascii')).hexdigest()
    if key not in cache:
        original = base64.b64decode(encoded, validate=True)
        with Image.open(io.BytesIO(original)) as image:
            image.thumbnail((640, 640), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            transparent = 'A' in image.getbands() and image.getchannel('A').getextrema()[0] < 255
            if transparent:
                image.save(output, format='PNG', optimize=True)
                mime = 'image/png'
            else:
                image.convert('RGB').save(output, format='JPEG', quality=78, optimize=True)
                mime = 'image/jpeg'
            cache[key] = 'data:' + mime + ';base64,' + base64.b64encode(output.getvalue()).decode('ascii')
    count[0] += 1
    return cache[key]

text = re.sub(r'data:image/png;base64,([A-Za-z0-9+/=]+)', compact, text)
text = text.replace('<title>Workspace Visual History</title>', '<title>AstroProcessAtlas — Example report</title>')
text = text.replace('<h1>Workspace Visual History</h1>', '<h1>AstroProcessAtlas</h1>')
banner = ('<div class="meta-info"><b>AstroProcessAtlas showcase report</b>'
          '<p>This example comes from a real processing session. Embedded previews have been '
          'resized to at most 640 pixels and compressed for download. It is a demonstration '
          'of the interface, not a reference for judging full-resolution image quality.</p></div>')
text = text.replace('<body>', '<body>' + banner, 1)
# The image metadata in the public demo needs filenames, not local folder locations.
text = re.sub(r'(<b>File:</b> <span data-no-i18n>)([^<]*)(</span>)',
              lambda m: m[1] + re.split(r'[/\\]', m[2])[-1] + m[3], text)
args.destination.parent.mkdir(parents=True, exist_ok=True)
args.destination.write_text(text, encoding='utf-8')
print(f'{len(cache)} unique images; {count[0]} embedded occurrences; '
      f'{args.source.stat().st_size:,} -> {args.destination.stat().st_size:,} bytes')
