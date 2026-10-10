"""Build manual downloads and prepare a PixInsight update package (Python 3)."""
import argparse
import datetime as dt
import hashlib
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]


def build(version, date, output, signature=None):
    source = (ROOT / 'AstroProcessAtlas.js').read_bytes()
    actual = re.search(rb'ASTROPROCESS_ATLAS_VERSION\s*=\s*"([^"]+)"', source).group(1).decode()
    if not re.fullmatch(r'\d+\.\d+\.\d+', version) or actual != version:
        raise ValueError('Release version must match ASTROPROCESS_ATLAS_VERSION: ' + actual)
    day = dt.datetime.strptime(date, '%Y%m%d')
    output.mkdir(parents=True, exist_ok=True)
    filename = f'{date}-AstroProcessAtlas-{version}.zip'
    prefix = 'src/scripts/AstroProcessAtlas/'
    files = {'AstroProcessAtlas.js': source}
    for name in ('LICENSE', 'README.md', 'CHANGELOG.md'):
        files[name] = (ROOT / name).read_bytes()
    if signature:
        files['AstroProcessAtlas.xsgn'] = signature.read_bytes()
    with zipfile.ZipFile(output / filename, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(prefix + name, (day.year, day.month, day.day, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    data = (output / filename).read_bytes()
    (output / 'SHA256SUMS.txt').write_text(hashlib.sha256(data).hexdigest() + '  ' + filename + '\n', encoding='utf-8')
    manifest = f'''<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">
  <description>AstroProcessAtlas by YoruHikari — https://www.yoruhikari.gr/</description>
  <platform os="all" arch="noarch" version="1.9.4:1.9.4">
    <package fileName="{filename}" sha1="{hashlib.sha1(data).hexdigest()}" type="script" releaseDate="{date}">
      <title>AstroProcessAtlas {escape(version)}</title>
      <description><p>Workspace processing history reports. Copyright 2026 YoruHikari Astrophotography. MIT License.</p></description>
    </package>
  </platform>
</xri>
'''
    (output / 'updates.xri').write_text(manifest, encoding='utf-8')
    return output / filename


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', required=True, help='SemVer without the v prefix')
    parser.add_argument('--date', required=True, help='YYYYMMDD release date')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--signature', type=Path, help='CodeSign signature of this exact script')
    args = parser.parse_args()
    print(build(args.version, args.date, args.output, args.signature))
