#!/usr/bin/env python3
"""Verify kinhtest2/tungkinh3 sharing after App Hub collects its modules.

Run from App-Hub root: python3 scripts/verify_apphub_shared.py public/modules
"""
import hashlib
import json
import sys
from pathlib import Path


def fail(message):
    raise SystemExit(f"FAIL: {message}")


def sha256_file(path):
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(data)
    return hasher.digest()


def main():
    modules = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/modules').resolve()
    kinh = modules / 'kinhtest2'
    tung = modules / 'tungkinh3'
    for root in (kinh, tung):
        if not (root / 'index.html').is_file():
            fail(f"Missing module index.html: {root / 'index.html'}")

    tracks_path = tung / 'tracks.json'
    if not tracks_path.is_file():
        fail(f"Missing tracks.json: {tracks_path}")
    tracks = json.loads(tracks_path.read_text(encoding='utf-8'))
    if not isinstance(tracks, list) or len(tracks) != 3:
        fail('Expected three tracks in tungkinh3/tracks.json')

    for i, track in enumerate(tracks):
        sources = track.get('sources') or []
        expected_dir = kinh if i < 2 else tung
        valid = False
        for src in sources:
            mp3 = (tung / src['mp3']).resolve()
            srt = (tung / src['srt']).resolve()
            if mp3.parent != expected_dir or srt.parent != expected_dir:
                continue
            if mp3.is_file() and srt.is_file() and '-->' in srt.read_text(encoding='utf-8-sig'):
                print(f"OK track {i+1}: {track.get('title','')} -> {mp3.relative_to(modules)}")
                valid = True
                break
        if not valid:
            fail(f"Missing a valid MP3/SRT pair for track {i+1} in {expected_dir}")

    shared_hashes = {sha256_file(p) for p in kinh.iterdir()
                     if p.is_file() and p.suffix.lower() in {'.mp3', '.srt'}}
    for p in tung.iterdir():
        if p.is_file() and p.suffix.lower() in {'.mp3', '.srt'}:
            if sha256_file(p) in shared_hashes:
                fail(f"Duplicate MP3/SRT in tungkinh3: {p.name}")

    print('PASS: Both modules exist, all three tracks resolve offline, and no shared MP3/SRT is duplicated.')


if __name__ == '__main__':
    main()
