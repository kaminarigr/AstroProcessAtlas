"""Fail closed on incomplete release files. PixInsight verifies cryptographic trust."""
import argparse
import base64
import hashlib
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


def validate(folder, require_signed=False):
    text = (folder / 'updates.xri').read_text(encoding='utf-8-sig')
    match = re.fullmatch(r'\s*(<\?xml[^>]*\?>\s*)?(<xri\b.*?</xri>)\s*(<Signature\b.*?</Signature>)?\s*', text, re.S)
    if not match:
        raise ValueError('Invalid updates.xri')
    root = ET.fromstring(match[2])
    signature = ET.fromstring(match[3]) if match[3] else None
    if require_signed and signature is None:
        raise ValueError('A signed updates.xri is required')
    if signature is not None and (not signature.get('developerId') or signature.get('developerId').lower() == 'local' or signature.get('encoding') != 'Base64'):
        raise ValueError('A CPD repository signature is required')
    if signature is not None and len(base64.b64decode(''.join(''.join(signature.itertext()).split()), validate=True)) != 64:
        raise ValueError('Invalid repository signature encoding')
    packages = root.findall('./platform/package')
    if len(packages) != 1:
        raise ValueError('Expected one release package')
    for package in packages:
        name = package.get('fileName', '')
        if not re.fullmatch(r'\d{8}-AstroProcessAtlas-\d+\.\d+\.\d+\.zip', name):
            raise ValueError('Unexpected package filename')
        data = (folder / name).read_bytes()
        if hashlib.sha1(data).hexdigest() != package.get('sha1'):
            raise ValueError('Package checksum does not match manifest')
        with zipfile.ZipFile(folder / name) as archive:
            prefix = 'src/scripts/AstroProcessAtlas/'
            expected = {prefix + n for n in ('AstroProcessAtlas.js', 'AstroProcessAtlas.svg', 'LICENSE', 'README.md', 'CHANGELOG.md')}
            if signature is not None:
                expected.add(prefix + 'AstroProcessAtlas.xsgn')
            if set(archive.namelist()) != expected or len(archive.namelist()) != len(expected):
                raise ValueError('Unexpected package contents')
            version = re.search(rb'ASTROPROCESS_ATLAS_VERSION\s*=\s*"([^"]+)"', archive.read(prefix + 'AstroProcessAtlas.js'))
            if not version or not name.endswith('-' + version[1].decode() + '.zip'):
                raise ValueError('Package and script versions differ')
            if signature is None:
                continue
            script_signature = ET.fromstring(archive.read(prefix + 'AstroProcessAtlas.xsgn'))
            identities = [e for e in script_signature.iter() if e.tag.split('}')[-1] == 'Signature']
            codes = [e for e in script_signature.iter() if e.tag.split('}')[-1] == 'CodeSignature']
            if len(identities) != 1 or identities[0].get('developerId') != signature.get('developerId'):
                raise ValueError('Script and repository signing identities must match')
            if len(codes) != 1 or codes[0].get('encoding') != 'Base64':
                raise ValueError('Missing script code signature')
            if len(base64.b64decode(''.join(''.join(codes[0].itertext()).split()), validate=True)) != 64:
                raise ValueError('Invalid script signature encoding')
    print('Package structure, version and checksum verified (' + ('signed' if signature is not None else 'unsigned') + ').')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--require-signed', action='store_true')
    args = parser.parse_args()
    validate(args.folder, args.require_signed)
