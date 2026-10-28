#!/usr/bin/env python3
"""Package the user's public static GitHub repos as offline Capacitor web modules.

Local testing: python scripts/collect_modules.py --local-zips /mnt/data
GitHub Actions: python scripts/collect_modules.py
Only the COPY inside public/modules is modified; no source repository is changed.
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'modules'
REGISTRY = ROOT / 'public' / 'modules.json'
CONFIG = json.loads((ROOT / 'modules.config.json').read_text(encoding='utf-8'))
OWNER = CONFIG['owner']
TOKEN = os.getenv('GH_TOKEN') or os.getenv('GITHUB_TOKEN') or ''


def request(url):
    headers = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'apphub-collect-modules',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    # GitHub Actions' repo-scoped token may not have access to private repos.
    if TOKEN:
        headers['Authorization'] = f'Bearer {TOKEN}'
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=45) as response:
        result = response.read(150 * 1024 * 1024 + 1)
    if len(result) > 150 * 1024 * 1024:
        raise RuntimeError('Repo archive too large (>150 MB compressed)')
    return result


def discover_repositories():
    if not CONFIG.get('autoDiscoverByTopic', False):
        return []
    topic = CONFIG['topic']
    found = []
    for page in range(1, 4):
        q = urllib.parse.quote(f'user:{OWNER} topic:{topic}')
        url = f'https://api.github.com/search/repositories?q={q}&per_page=100&page={page}'
        try:
            results = json.loads(request(url))['items']
        except (urllib.error.URLError, ValueError, KeyError) as exc:
            print(f'WARN: Topic discovery temporarily unavailable: {exc}', file=sys.stderr)
            break
        for item in results:
            if (item.get('owner', {}).get('login', '').lower() == OWNER.lower()
                    and not item.get('archived')
                    and item['name'].lower() != 'app-hub'):
                found.append({'repo': item['name']})
        if len(results) < 100:
            break
    return found


def read_archive(repo, local_zips):
    if local_zips:
        filename = Path(local_zips) / f'{repo}-main.zip'
        if not filename.is_file():
            raise FileNotFoundError(f'Missing local ZIP: {filename}')
        return filename.read_bytes()
    url = f'https://api.github.com/repos/{OWNER}/{repo}/zipball'
    return request(url)


def unpack_safe(blob, dest):
    count = 0
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        files = [f for f in archive.infolist() if not f.is_dir()]
        for file in files:
            # Archives from GitHub have one top-level directory.
            parts = Path(file.filename).parts
            if len(parts) < 2:
                continue
            sub = parts[1:]
            if any(p in ('.', '..') for p in sub) or any(p.startswith('.git') for p in sub):
                continue
            if any(p in ('node_modules', 'dist', 'android', '.github') for p in sub):
                continue
            if file.filename.lower().endswith(('.rar', '.7z', '.zip')):
                continue  # archive downloads aren't used by offline Web modules
            if file.external_attr >> 16 & 0o170000 == 0o120000:
                continue  # symlink
            if file.file_size > 80 * 1024 * 1024:
                raise RuntimeError(f'File too large: {file.filename}')
            target = dest.joinpath(*sub)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(file) as source, target.open('wb') as result:
                shutil.copyfileobj(source, result)
            count += 1
    if not (dest / 'index.html').exists():
        raise ValueError('This repository does not have a root index.html (only static PWA supported)')
    return count


def transform_module_html(dest, repo, bundled_repos):
    path = dest / 'index.html'
    text = path.read_text(encoding='utf-8-sig')
    # Native Capacitor bundles are already stored offline; legacy PWA SWs can
    # intercept stale files or delete unrelated caches, so don't register them.
    text = re.sub(r'navigator\.serviceWorker\.register\(\s*["\'](?:\./)?sw\.js["\']\s*\)',
                  'Promise.resolve()', text)
    # Avoid remote fonts on first offline launch. System font is used instead.
    if repo == 'tapluyenpiano':
        text = re.sub(r'<link\b[^>]*href=["\']https://fonts\.(?:googleapis|gstatic)\.com[^>]*>', '', text)
        target = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
        if target not in text:
            print('WARN: Piano CDN JSZip link changed; inspect offline dependencies', file=sys.stderr)
        text = text.replace(target, './vendor/jszip.min.js')
        # On APK, use the locally generated index of all MXL files, instead of
        # trying to read GitHub API or rely on unsupported directory listing.
        needle = 'async function initSongList() {'
        injector = '''async function initSongList() {
      if (window.__APP_HUB__) {
        try {
          const listing = await (await fetch('./apphub-files.json')).json();
          const songs = listing.files.filter(f => /\\.(mxl|xml|musicxml)$/i.test(f));
          populateSongSelect(songs);
          if (songs.length) loadSelectedSong(songs[0]);
          return;
        } catch (error) { console.warn('Offline song list:', error); }
      }
'''
        if needle not in text: raise RuntimeError('Piano initSongList() signature changed')
        text = text.replace(needle, injector, 1)
        library = ROOT / 'node_modules/jszip/dist/jszip.min.js'
        if not library.is_file():
            print('WARN: jszip node_modules unavailable; run npm install before production build', file=sys.stderr)
        else:
            (dest / 'vendor').mkdir(exist_ok=True)
            shutil.copy2(library, dest / 'vendor/jszip.min.js')
    if repo in ('kinhtest2', 'thoisao'):
        needle = 'async function discoverServerTracks() {'
        injector = '''async function discoverServerTracks() {
            if (window.__APP_HUB__) {
                try {
                    const listing = await (await fetch('./apphub-files.json')).json();
                    return matchMp3AndSubPairs(listing.files);
                } catch (error) { console.warn('Offline track list:', error); }
            }
'''
        if needle not in text: raise RuntimeError('Audio app discoverServerTracks() signature changed')
        text = text.replace(needle, injector, 1)
    if repo == 'tungkinh':
        # Make CDN styles and QR library local so the reader works offline.
        vendor = dest / 'vendor'
        vendor.mkdir(exist_ok=True)
        css_command = ['node', str(ROOT / 'scripts/generate_tailwind_css.mjs'), str(path), str(vendor / 'tailwind.css')]
        result = subprocess.run(css_command, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(f'Could not compile offline Tailwind CSS: {result.stdout} {result.stderr}')
        print(result.stdout.strip())
        shutil.copy2(ROOT / 'scripts/vendor/tungkinh-qr-offline.js', vendor / 'qr-offline.js')
        text = text.replace('<script src="https://cdn.tailwindcss.com"></script>', '<link rel="stylesheet" href="./vendor/tailwind.css">')
        text = text.replace('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', './vendor/qr-offline.js')
        # QR share URLs should point to the public site, never to APK localhost.
        text = text.replace('const finalUrl = url.toString();', '''const finalUrl = window.__APP_HUB__
            ? 'https://gptlohoi-del.github.io/tungkinh/' + url.search
            : url.toString();''')
        text = text.replace('const linkToCopy = window.location.href;', '''const linkToCopy = window.__APP_HUB__
            ? 'https://gptlohoi-del.github.io/tungkinh/' + window.location.search
            : window.location.href;''')
    if repo == 'linktong':
        # External sites still require connectivity; bundled module links are
        # routed through App Hub navigation so they work offline.
        ids = json.dumps(sorted(bundled_repos), ensure_ascii=False)
        old = "aTag.href = link.url;"
        if old not in text:
            raise RuntimeError('Linktong link assignment changed; update App Hub integration')
        new = f'''aTag.href = link.url;
                    if (window.__APP_HUB__) {{
                        const localIds = new Set({ids});
                        try {{
                            const destUrl = new URL(link.url);
                            const segments = destUrl.pathname.split('/').filter(Boolean);
                            const repoId = segments[0]?.toLowerCase();
                            if (destUrl.hostname === 'gptlohoi-del.github.io' && localIds.has(repoId)) {{
                                aTag.href = '../' + repoId + '/index.html';
                                aTag.target = '_self';
                                aTag.addEventListener('click', (event) => {{
                                    event.preventDefault();
                                    window.parent.postMessage({{ type: 'APPHUB_OPEN_MODULE', id: repoId }}, window.location.origin);
                                }});
                            }}
                        }} catch (e) {{ console.warn('Invalid link', link.url); }}
                    }}'''
        text = text.replace(old, new, 1)
        text = text.replace("aTag.target = '_blank';", "if (aTag.target !== '_self') aTag.target = '_blank';")
    text = re.sub(r'(<head[^>]*>)', r'\1\n<script>window.__APP_HUB__ = true;</script>', text, count=1, flags=re.I)
    path.write_text(text, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--local-zips', help='Folder with *-main.zip test archives')
    args = parser.parse_args()
    desired = {item['repo'].lower(): dict(item) for item in CONFIG['repositories']}
    if not args.local_zips:
        # Do not silently drop pinned modules on transient API failures.
        for mod in discover_repositories():
            desired.setdefault(mod['repo'].lower(), mod)
    staging = ROOT / 'public' / 'modules-staging'
    if staging.exists(): shutil.rmtree(staging)
    staging.mkdir(parents=True)
    modules = []
    try:
        for slug, info in sorted(desired.items()):
            if not re.fullmatch(r'[a-zA-Z0-9_-]+', slug):
                raise ValueError(f'Invalid repository name: {slug}')
            dest = staging / slug
            dest.mkdir()
            print('Collecting', OWNER, slug, flush=True)
            n = unpack_safe(read_archive(info['repo'], args.local_zips), dest)
            meta_path = dest / 'apphub.json'
            meta = json.loads(meta_path.read_text(encoding='utf8')) if meta_path.is_file() else {}
            if meta and meta.get('id', slug) != slug:
                raise ValueError(f'apphub.json id must equal repo name: {slug}')
            transform_module_html(dest, slug, desired.keys())
            files = sorted(p.name for p in dest.iterdir() if p.is_file())
            (dest / 'apphub-files.json').write_text(json.dumps({'files': files}, ensure_ascii=False, indent=2), encoding='utf8')
            modules.append({
                'id': slug, 'name': info.get('name') or meta.get('name') or info['repo'],
                'entry': meta.get('entry') or 'index.html',
                'version': meta.get('version') or '1.0',
                'icon': info.get('icon') or meta.get('icon') or '📱',
                'description': info.get('description') or meta.get('description') or 'Tính năng cài đặt offline',
            })
            print(f'  {n} assets, offline listing created', flush=True)
        if OUT.exists(): shutil.rmtree(OUT)
        staging.rename(OUT)
        REGISTRY.write_text(json.dumps({'modules': modules}, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        print(f'OK: {len(modules)} bundled modules')
    finally:
        if staging.exists(): shutil.rmtree(staging)


if __name__ == '__main__':
    main()
