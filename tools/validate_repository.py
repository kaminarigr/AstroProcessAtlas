"""Fail closed on incomplete release files. PixInsight verifies cryptographic trust."""
import argparse
import base64
import hashlib
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


def validate(folder):
    text = (folder / 'updates.xri').read_text(encoding='utf-8-sig')
    match = re.fullmatch(r'\s*(<\?xml[^>]*\?>\s*)?(<xri\b.*?</xri>)\s*(<Signature\b.*?</Signature>)\s*', text, re.S)
    if not match:
        raise ValueError('A signed updates.xri is required')
    root, signature = ET.fromstring(match[2]), ET.fromstring(match[3])
    if not signature.get('developerId') or signature.get('developerId').lower() == 'local' or signature.get('encoding') != 'Base64':
        raise ValueError('A CPD repository signature is required')
    if len(base64.b64decode(''.join(signature.itertext()).strip(), validate=True)) != 64:
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
            raise ValueError('Package checksum does not match signed manifest')
        with zipfile.ZipFile(folder / name) as archive:
            prefix = 'src/scripts/AstroProcessAtlas/'
            expected = {prefix + n for n in ('AstroProcessAtlas.js', 'AstroProcessAtlas.xsgn', 'LICENSE', 'README.md', 'CHANGELOG.md')}
            if set(archive.namelist()) != expected or len(archive.namelist()) != len(expected):
                raise ValueError('Unexpected or unsigned package contents')
            script_signature = ET.fromstring(archive.read(prefix + 'AstroProcessAtlas.xsgn'))
            identities = [e for e in script_signature.iter() if e.tag.split('}')[-1] == 'Signature']
            codes = [e for e in script_signature.iter() if e.tag.split('}')[-1] == 'CodeSignature']
            if len(identities) != 1 or identities[0].get('developerId') != signature.get('developerId'):
                raise ValueError('Script and repository signing identities must match')
            if len(codes) != 1 or codes[0].get('encoding') != 'Base64':
                raise ValueError('Missing script code signature')
            if len(base64.b64decode(''.join(''.join(codes[0].itertext()).split()), validate=True)) != 64:
                raise ValueError('Invalid script signature encoding')
    print('Package structure and checksums verified; PixInsight must verify CPD signatures.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    validate(parser.parse_args().folder)
