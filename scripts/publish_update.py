#!/usr/bin/env python3
"""Create a full OTA ZIP from dist/ and a GitHub Pages update manifest.
The ZIP contains index.html at its root, as expected by Capacitor Updater.
"""
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
SITE = ROOT / 'site'
OWNER = 'gptlohoi-del'
PROJECT = 'App-Hub'
URL_BASE = f'https://{OWNER}.github.io/{PROJECT}/updates'
LATEST_URL = f'{URL_BASE}/latest.json'


def file_hash(files):
    hash_ = hashlib.sha256()
    for file in files:
        relative = file.relative_to(DIST).as_posix()
        hash_.update(relative.encode('utf-8'))
        with file.open('rb') as f:
            while chunk := f.read(1024 * 1024):
                hash_.update(chunk)
    return hash_.hexdigest()


def main():
    if not (DIST / 'index.html').is_file():
        raise RuntimeError('First run npm run build; dist/index.html not found')
    all_files = sorted(f for f in DIST.rglob('*') if f.is_file())
    if not (DIST / 'modules.json').exists() or not all_files:
        raise RuntimeError('Missing modules.json / dist is empty')
    bundle_hash = file_hash(all_files)
    print('Web bundle SHA256:', bundle_hash)
    prior = None
    try:
        req = urllib.request.Request(LATEST_URL + '?cb=' + bundle_hash[:8], headers={'User-Agent': 'AppHub-Publisher'})
        with urllib.request.urlopen(req, timeout=10) as result:
            prior = json.load(result)
    except (urllib.error.URLError, ValueError, TimeoutError):
        pass
    changed = prior is None or prior.get('sha256') != bundle_hash
    if changed:
        run_no = int(os.getenv('GITHUB_RUN_NUMBER') or '1')
        version = f'1.0.{run_no}'
        updates = SITE / 'updates'
        updates.mkdir(parents=True, exist_ok=True)
        zipname = f'apphub-{version}.zip'
        out = updates / zipname
        with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
            for file in all_files:
                archive.write(file, file.relative_to(DIST).as_posix())
        manifest = {
            'version': version,
            'url': f'{URL_BASE}/{zipname}',
            'sha256': bundle_hash,
            'sizeBytes': out.stat().st_size,
        }
        (updates / 'latest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
        (SITE / '.nojekyll').write_text('', encoding='utf-8')
        (SITE / 'index.html').write_text('<html><meta charset="utf-8"><title>App Hub OTA</title><p>App Hub update files.</p></html>', encoding='utf-8')
        print('New OTA:', manifest)
    else:
        print('Web bundle has not changed: skip publishing')
    output = os.getenv('GITHUB_OUTPUT')
    if output:
        with open(output, 'a', encoding='utf-8') as f:
            f.write(f'changed={str(changed).lower()}\n')
    else:
        print('changed=', changed)


if __name__ == '__main__':
    main()
