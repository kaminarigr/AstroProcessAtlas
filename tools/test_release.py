import tempfile
import unittest
from pathlib import Path
from build_release import build, ROOT
from validate_repository import validate
import re

VERSION = re.search(r'ASTROPROCESS_ATLAS_VERSION\s*=\s*"([^"]+)"', (ROOT / 'AstroProcessAtlas.js').read_text(encoding='utf-8')).group(1)


class ReleaseTests(unittest.TestCase):
    def test_reproducible_and_minimal(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            first = build(VERSION, '20261009', folder).read_bytes()
            self.assertEqual(first, build(VERSION, '20261009', folder).read_bytes())
            import xml.etree.ElementTree as ET
            platform = ET.parse(folder / 'updates.xri').getroot().find('platform')
            self.assertEqual(platform.get('version'), '1.9.3:1.9.4')
            import zipfile
            with zipfile.ZipFile(build(VERSION, '20261009', folder)) as archive:
                self.assertEqual(len(archive.namelist()), 5)
                self.assertIn('src/scripts/AstroProcessAtlas/AstroProcessAtlas.svg', archive.namelist())
                self.assertIn('src/scripts/AstroProcessAtlas/LICENSE', archive.namelist())

    def test_version_mismatch(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                build('999.0.0', '20261009', Path(temp))

    def test_unsigned_repository_and_optional_signing(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            build(VERSION, '20261009', folder)
            validate(folder)
            with self.assertRaises(ValueError):
                validate(folder, require_signed=True)

    def test_corrupted_package_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            package = build(VERSION, '20261009', folder)
            package.write_bytes(package.read_bytes() + b'corruption')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                validate(folder)


if __name__ == '__main__':
    unittest.main()
