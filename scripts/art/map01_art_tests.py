"""Repository-only environment integrity, packing and source-guard regressions."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import unittest
from unittest.mock import patch
import zlib

P = Path(__file__).parent
spec = importlib.util.spec_from_file_location('map01_importer_test', P/'import-map01.py')
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)

def packed_rgba(raw):
    w, h = art.png.png_info(raw)  # Checks every chunk CRC and header bound.
    offset = 8
    compressed = []
    while offset < len(raw):
        length = struct.unpack('>I', raw[offset:offset+4])[0]
        tag = raw[offset+4:offset+8]
        payload = raw[offset+8:offset+8+length]
        if tag == b'IHDR':
            assert struct.unpack('>IIBBBBB', payload)[2:] == (8, 6, 0, 0, 0)
        if tag == b'IDAT':
            compressed.append(payload)
        offset += length+12
    rows = zlib.decompress(b''.join(compressed))
    stride = w*4+1
    assert len(rows) == h*stride
    assert all(rows[y*stride] == 0 for y in range(h))
    return w, h, b''.join(rows[y*stride+1:(y+1)*stride] for y in range(h))

class Map01ArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(art.DATA.read_text())
        cls.manifest = art.load_manifest()

    def test_manifest_exactly_covers_definition_ids_without_changing_logical_metadata(self):
        manifest, data = self.manifest, self.data
        self.assertEqual(manifest['assetId'], 'map01-environment')
        self.assertEqual(manifest['sourceCommit'], art.PIN)
        ids = [f['objectId'] for f in manifest['images']]
        expected = sorted({d['objectId'] for d in data['definitions']})
        self.assertEqual(ids, expected)
        self.assertEqual((len(ids), sum(i <= 45 for i in ids), sum(i > 45 for i in ids)), (42, 18, 24))
        winner_ids = {data['definitions'][p['definition']]['objectId'] for p in data['placements']}
        self.assertEqual(set(ids)-winner_ids, {27, 65, 68})
        self.assertEqual(len(winner_ids), 39)
        for frame in manifest['images']:
            self.assertEqual(set(frame), {'objectId', 'sourcePath', 'image', 'sourceSizePx', 'sha256', 'atlasRectPx', 'opaqueProbePx', 'opaqueProbeRgba'})
        self.assertEqual(art.MANIFEST.read_text(), art.manifest_text(manifest))

    def test_every_source_pixel_crc_hash_rect_probe_and_extrusion_is_preserved(self):
        manifest = self.manifest
        raw = (art.ASSETS/manifest['atlas']['image']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), manifest['atlas']['sha256'])
        aw, ah, pixels = packed_rgba(raw)
        self.assertEqual([aw, ah], [1024, 1024])
        self.assertEqual(manifest['atlas']['sizePx'], [aw, ah])
        self.assertEqual(manifest['atlas']['extrudePx'], 2)
        rectangles = []
        occupied_rows = [[] for _ in range(ah)]
        for frame in manifest['images']:
            with self.subTest(object=frame['objectId']):
                i = frame['objectId']
                source = self.data['objects'][i-1]
                self.assertEqual(source['id'], i)
                self.assertEqual(frame['image'], f'art/environments/map01/objects/object-{i:03}.png')
                self.assertEqual(frame['sourcePath'], source['sourcePath'])
                raw = (art.ASSETS/frame['image']).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), source['sha256'])
                self.assertEqual(frame['sha256'], source['sha256'])
                w, h, original = art.png.decode_png(raw)  # All source CRC/filter/palette/alpha paths.
                self.assertEqual([w, h], frame['sourceSizePx'])
                self.assertEqual([w, h], source['sourceSizePx'])
                x, y, rw, rh = frame['atlasRectPx']
                self.assertTrue(all(type(v) is int for v in [x, y, rw, rh]))
                self.assertEqual([rw, rh], [w, h])
                self.assertGreaterEqual(min(x, y), 2)
                self.assertLessEqual(x+w+2, aw)
                self.assertLessEqual(y+h+2, ah)
                rectangle = (x-2, y-2, x+w+2, y+h+2)
                for a, b, c, d in rectangles:
                    self.assertTrue(rectangle[2] <= a or rectangle[0] >= c or rectangle[3] <= b or rectangle[1] >= d,
                                    'Extruded sprite rectangles overlap')
                rectangles.append(rectangle)
                for dy in range(-2, h+2):
                    row = min(h-1, max(0, dy))
                    start = row*w*4
                    original_row = original[start:start+w*4]
                    expected = original_row[:4]*2+original_row+original_row[-4:]*2
                    at = ((y+dy)*aw+x-2)*4
                    self.assertEqual(pixels[at:at+len(expected)], expected)
                    occupied_rows[y+dy].append((x-2, x+w+2))
                px, py = frame['opaqueProbePx']
                self.assertTrue(0 <= px < w and 0 <= py < h)
                at = (py*w+px)*4
                self.assertEqual(list(original[at:at+4]), frame['opaqueProbeRgba'])
                self.assertEqual(frame['opaqueProbeRgba'][3], 255)
        # Gaps outside every full extruded rectangle remain transparent zero RGBA.
        for y, regions in enumerate(occupied_rows):
            start = 0
            for left, right in sorted(regions)+[(aw, aw)]:
                self.assertEqual(pixels[(y*aw+start)*4:(y*aw+left)*4], bytes((left-start)*4))
                start = right

    def test_repository_only_reconstruction_is_byte_identical_and_complete(self):
        values = art.committed_build(self.data)
        art.verify(*values)
        self.assertEqual(values[0], self.manifest)

    def test_panorama_bytes_dimensions_and_source_paths_stay_separate_from_atlas(self):
        self.assertEqual(set(self.manifest['backgrounds']), {'back', 'front'})
        for name, size in [('back', [1536, 256]), ('front', [2048, 256])]:
            frame = self.manifest['backgrounds'][name]
            self.assertEqual(set(frame), {'image', 'sourcePath', 'sourceSizePx', 'sha256'})
            self.assertEqual(frame['image'], f'textures/map01-{name}.png')
            self.assertEqual(frame['sourcePath'], f'{art.SOURCE_FOLDER}/{name}.png')
            raw = (art.ASSETS/frame['image']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), frame['sha256'])
            w, h, pixels = art.png.decode_png(raw)
            self.assertEqual([w, h], size)
            self.assertEqual(frame['sourceSizePx'], size)
            # Retained source columns are not falsely described as identical seams.
            first = b''.join(pixels[y*w*4:y*w*4+4] for y in range(h))
            last = b''.join(pixels[(y*w+w-1)*4:(y*w+w)*4] for y in range(h))
            self.assertNotEqual(first, last)

    def test_height_first_layout_fits_1024_and_is_order_independent(self):
        size, rects = art.layout(self.manifest['images'])
        self.assertEqual(size, 1024)
        self.assertEqual(max(y+h+2 for x, y, w, h in rects.values()), 866)
        self.assertEqual((size, rects), art.layout(list(reversed(self.manifest['images']))))
        self.assertEqual(rects, {f['objectId']: f['atlasRectPx'] for f in self.manifest['images']})

    def test_packing_fails_on_overflow_duplicate_or_invalid_dimensions(self):
        self.assertEqual(art.layout([{'objectId': 1, 'sourceSizePx': [1021, 1]}]),
                         (2048, {1: [2, 2, 1021, 1]}))
        for frames in [[], [{'objectId': 1, 'sourceSizePx': [2048, 1]}],
                       [{'objectId': 1, 'sourceSizePx': [1, 1]}]*2,
                       [{'objectId': 1, 'sourceSizePx': [0, 1]}]]:
            with self.subTest(frames=frames), self.assertRaises(ValueError):
                art.layout(frames)
        with self.assertRaises(ValueError):
            art.layout([{'objectId': 1, 'sourceSizePx': [1, 1]}], (4096,))

    def test_source_guards_reject_wrong_head_or_dirty_resources_and_code(self):
        for responses in [['0'*40], [art.PIN, ' M Resources/Maps/MapLevels/Map1/1.png'],
                          [art.PIN, ' M src/Logger/Logger.cpp']]:
            with self.subTest(responses=responses), patch.object(art.subprocess, 'check_output', side_effect=responses), self.assertRaises(ValueError):
                art.source_guard(Path('/unused'))

    def test_catalog_path_and_source_hash_changes_fail_explicitly(self):
        changed = copy.deepcopy(self.data)
        changed['objects'][0]['sourcePath'] = '../unexpected.png'
        with self.assertRaisesRegex(ValueError, 'source path'):
            art.selected_objects(changed)
        changed = copy.deepcopy(self.data)
        changed['objects'][0]['sha256'] = '0'*64
        raw = (art.ASSETS/self.manifest['images'][0]['image']).read_bytes()
        with self.assertRaisesRegex(ValueError, 'source hash'):
            art.build(changed, lambda _: raw)

if __name__ == '__main__':
    unittest.main()
