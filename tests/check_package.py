"""Verify README images and the public release ZIP contain no private inputs."""
from pathlib import Path
from zipfile import ZipFile
import re
readme=Path('README.md').read_text(encoding='utf-8')
images=re.findall(r'!\[[^]]*\]\(([^)]+)\)',readme)
assert len(images)==4
for name in images:
    assert Path(name).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
with ZipFile('dist/quick-timesheet-0.3.0.zip') as z:
    assert z.testzip() is None
    assert all(not n.startswith(('reference/','tests/','.git/')) for n in z.namelist())
    assert not any(n.endswith('.xlsx') for n in z.namelist()) # Default generated offline
    assert all(n in z.namelist() for n in images)
    assert 'templates.js' in z.namelist() and 'manifest.json' in z.namelist()
print('PASS: four README PNG paths resolve; public ZIP includes screenshots/runtime and excludes private references and tests.')
