#!/usr/bin/env python3
"""Verify/import Map1 cutouts and original panoramas. Python stdlib only.

Default --source checks the pinned source against committed outputs. --write is
explicit. --committed reconstructs the atlas from repository-only input PNGs.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PIN = '6882721c99bc79365f815f68d389bf5078129e68'
DATA = ROOT/'outrun/assets/data/biomes/map01.json'
MANIFEST = ROOT/'outrun/src/content/environments/map01.manifest.ts'
ASSETS = ROOT/'outrun/assets'
SOURCE_FOLDER = 'Resources/Maps/MapLevels/Map1'
EXTRUDE = 2
spec = importlib.util.spec_from_file_location('map01_png_codec', Path(__file__).with_name('import-player-car.py'))
png = importlib.util.module_from_spec(spec)
spec.loader.exec_module(png)

def require(value, message):
    if not value:
        raise ValueError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def source_guard(source):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(source), *args], text=True).strip()
    require(git('rev-parse', 'HEAD') == PIN, 'Source HEAD must match pinned revision')
    require(not git('status', '--porcelain=v1', '--untracked-files=no', '--', 'Resources', 'src'),
            'Source Resources/src has tracked modifications')

def selected_objects(data):
    require(data['sourceCommit'] == PIN and data['$type'] == 'SourceBiome', 'Wrong canonical source biome')
    objects = {o['id']: o for o in data['objects']}
    ids = sorted({d['objectId'] for d in data['definitions']})
    require(len(ids) == 42 and sum(i <= 45 for i in ids) == 18 and sum(i > 45 for i in ids) == 24,
            'Expected exactly18 shared and24 local definition images')
    require(len(objects) == 71 and all(i in objects for i in ids), 'Invalid source object catalog')
    selected = [objects[i] for i in ids]
    for obj in selected:
        i = obj['id']
        expected = f'Resources/Maps/MapStartGoal/{i}.png' if i <= 45 else f'{SOURCE_FOLDER}/{i-45}.png'
        require(obj['sourcePath'] == expected, 'Unexpected source path for object '+str(i))
    return selected

def layout(frames, page_sizes=(1024, 2048)):
    """Stable height-first shelves; manifest order remains source object ID order."""
    require(frames and len({f['objectId'] for f in frames}) == len(frames), 'Empty/duplicate frame IDs')
    order = sorted(frames, key=lambda f: (-f['sourceSizePx'][1], -f['sourceSizePx'][0], f['objectId']))
    for size in page_sizes:
        require(isinstance(size, int) and 0 < size <= 2048, 'Invalid atlas page bound')
        x = y = row_height = 0
        rects = {}
        for frame in order:
            w, h = frame['sourceSizePx']
            require(type(w) is int and type(h) is int and w > 0 and h > 0, 'Invalid frame dimensions')
            if w+2*EXTRUDE > size or h+2*EXTRUDE > size:
                break
            if x+w+2*EXTRUDE > size:
                x = 0
                y += row_height
                row_height = 0
            if y+h+2*EXTRUDE > size:
                break
            rects[frame['objectId']] = [x+EXTRUDE, y+EXTRUDE, w, h]
            x += w+2*EXTRUDE
            row_height = max(row_height, h+2*EXTRUDE)
        if len(rects) == len(frames):
            return size, rects
    raise ValueError('Environment cutouts exceed2048 atlas page bound')

def atlas(frames, source_bytes):
    size, rects = layout(frames)
    pixels = bytearray(size*size*4)
    for frame in frames:
        raw = source_bytes[frame['objectId']]
        w, h, decoded = png.decode_png(raw)
        require([w, h] == frame['sourceSizePx'] and sha(raw) == frame['sha256'], 'Source pixels/hash mismatch')
        x, y, _, _ = rects[frame['objectId']]
        frame['atlasRectPx'] = rects[frame['objectId']]
        # Pick an actually opaque source texel nearest the center for cooked probes.
        probe = min(((abs(px-w/2)+abs(py-h/2), py, px)
                     for py in range(h) for px in range(w) if decoded[(py*w+px)*4+3] == 255), default=None)
        require(probe is not None, 'No opaque probe in object '+str(frame['objectId']))
        _, py, px = probe
        frame['opaqueProbePx'] = [px, py]
        frame['opaqueProbeRgba'] = list(decoded[(py*w+px)*4:(py*w+px)*4+4])
        for dy in range(-EXTRUDE, h+EXTRUDE):
            sy = min(h-1, max(0, dy))
            row = decoded[sy*w*4:(sy+1)*w*4]
            expanded = row[:4]*EXTRUDE+row+row[-4:]*EXTRUDE
            at = ((y+dy)*size+x-EXTRUDE)*4
            pixels[at:at+len(expanded)] = expanded
    return size, png.encode_png(size, size, pixels)

def build(data, read):
    images = []
    source_bytes = {}
    for obj in selected_objects(data):
        i, path = obj['id'], obj['sourcePath']
        raw = read(path)
        require(sha(raw) == obj['sha256'], 'Canonical source hash differs: '+path)
        require(list(png.png_info(raw)) == obj['sourceSizePx'], 'Canonical source dimensions differ: '+path)
        source_bytes[i] = raw
        images.append({'objectId': i, 'sourcePath': path,
                       'image': f'art/environments/map01/objects/object-{i:03}.png',
                       'sourceSizePx': obj['sourceSizePx'], 'sha256': sha(raw)})
    size, packed = atlas(images, source_bytes)
    backgrounds = {}
    background_bytes = {}
    for name, expected in [('back', [1536, 256]), ('front', [2048, 256])]:
        path = f'{SOURCE_FOLDER}/{name}.png'
        raw = read(path)
        require(list(png.png_info(raw)) == expected, 'Panorama dimensions differ: '+path)
        backgrounds[name] = {'image': f'textures/map01-{name}.png', 'sourcePath': path,
                             'sourceSizePx': expected, 'sha256': sha(raw)}
        background_bytes[name] = raw
    manifest = {'assetId': 'map01-environment', 'sourceCommit': PIN,
                'atlas': {'image': 'textures/map01-props.png', 'sizePx': [size, size],
                          'extrudePx': EXTRUDE, 'sha256': sha(packed)},
                'images': images, 'backgrounds': backgrounds}
    return manifest, source_bytes, packed, background_bytes

def manifest_text(data):
    return '// Generated by scripts/art/import-map01.py; image metadata only, never collision or placement.\nexport const MAP01_ART = '+json.dumps(data, indent=2)+' as const;\n'

def load_manifest(path=MANIFEST):
    payload = path.read_text().split('export const MAP01_ART = ', 1)[1]
    data, end = json.JSONDecoder().raw_decode(payload)
    require(payload[end:].strip() == 'as const;', 'Invalid manifest suffix')
    return data

def committed_build(data):
    old = load_manifest()
    paths = {f['sourcePath']: f['image'] for f in old['images']}
    paths.update({f['sourcePath']: f['image'] for f in old['backgrounds'].values()})
    canonical = {o['sourcePath']: f'art/environments/map01/objects/object-{o["id"]:03}.png'
                 for o in selected_objects(data)}
    canonical.update({f'{SOURCE_FOLDER}/{name}.png': f'textures/map01-{name}.png'
                      for name in ['back', 'front']})
    def read(path):
        # Never interpret manifest data as an arbitrary filesystem path.
        logical = paths[path]
        require(logical == canonical[path], 'Unexpected committed asset path')
        return (ASSETS/logical).read_bytes()
    return build(data, read)

def verify(manifest, originals, packed, backgrounds):
    require(MANIFEST.read_text() == manifest_text(manifest), 'Environment manifest differs')
    require((ASSETS/manifest['atlas']['image']).read_bytes() == packed, 'Environment atlas differs')
    for frame in manifest['images']:
        require((ASSETS/frame['image']).read_bytes() == originals[frame['objectId']], 'Original cutout differs')
    for name, entry in manifest['backgrounds'].items():
        require((ASSETS/entry['image']).read_bytes() == backgrounds[name], 'Original panorama differs')
    folder = ASSETS/'art/environments/map01/objects'
    require(set(folder.glob('*.png')) == {ASSETS/f['image'] for f in manifest['images']}, 'Unexpected/missing cutout inputs')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--source', type=Path)
    group.add_argument('--committed', action='store_true')
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    require(not args.write or args.source is not None, '--write requires pinned --source')
    data = json.loads(DATA.read_text())
    if args.source:
        source_guard(args.source)
        values = build(data, lambda p: (args.source/p).read_bytes())
    else:
        values = committed_build(data)
    manifest, originals, packed, backgrounds = values
    if args.write:
        for frame in manifest['images']:
            path = ASSETS/frame['image']
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(originals[frame['objectId']])
        (ASSETS/manifest['atlas']['image']).parent.mkdir(parents=True, exist_ok=True)
        (ASSETS/manifest['atlas']['image']).write_bytes(packed)
        for name, entry in manifest['backgrounds'].items():
            (ASSETS/entry['image']).write_bytes(backgrounds[name])
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(manifest_text(manifest))
    verify(*values)
    print(f'Verified42Map1 cutouts (18shared/24local), atlas{manifest["atlas"]["sizePx"]}, 2original panoramas; no logical metadata duplicated')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
