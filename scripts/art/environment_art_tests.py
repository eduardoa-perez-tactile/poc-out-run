"""Stdlib destination art proof: all15 families,627objects and30panoramas.

Run python3 -m unittest discover -s scripts/art -p environment_art_tests.py.
Full-source inventory is separate --source ... --inventory, never a fake committed pass.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch
P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('destination_importer',P/'import-environments.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
HEIGHTS={2:[1030],3:[1081],4:[1065],5:[1251,80],6:[1164,426],7:[1162],8:[1212],9:[849],10:[1249,596],11:[429],12:[802],13:[1109],14:[1099],15:[1267,215],16:[438]}

class DestinationArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ids=[i for i in range(2,17) if (art.MANIFESTS/f'{art.stem(i)}.manifest.ts').exists()]
        if cls.ids!=list(range(2,17)):raise AssertionError('Expected EXACT all15 destination families,627objects and30panoramas; partial imports are not final acceptance')
        cls.results={i:art.committed_build(i) for i in cls.ids}
        if sum(len(result['manifest']['images']) for result in cls.results.values())!=627:raise AssertionError('Expected EXACT627 imported object IDs')
        if sum(sum(layer in result['manifest'] for layer in ('back','front')) for result in cls.results.values())!=30:raise AssertionError('Expected EXACT30 panoramas')

    def test_all627_metadata_records_have_deterministic_bounded_source_layout(self):
        total=0
        for mid in range(2,17):
            data=art.data_for(mid);objects=art.source_objects(data);total+=len(objects)
            images=[{'objectId':o['id'],'sourceSizePx':o['sourceSizePx']} for o in objects]
            sizes,rects=art.layout(images)
            self.assertEqual(sizes,[[1024,h] for h in HEIGHTS[mid]])
            self.assertEqual((sizes,rects),art.layout(list(reversed(images))))
            self.assertEqual(set(rects),set(range(1,len(objects)+1)))
            self.assertTrue(all(w<=1024 and h<=1280 and w*h*4<8*1024*1024 for w,h in sizes))
        self.assertEqual(total,627)

    def test_committed_sources_reconstruct_exact_manifests_pages_and_originals(self):
        for mid,result in self.results.items():
            with self.subTest(map=mid):
                art.verify(result);m=result['manifest'];self.assertEqual(m['assetId'],art.stem(mid)+'-environment')
                self.assertEqual(set(m),{'assetId','mapId','sourceCommit','pages','images','back','front'})
                self.assertEqual(m['mapId'],mid);self.assertEqual(m['sourceCommit'],art.PIN)
                self.assertEqual([x['objectId'] for x in m['images']],list(range(1,art.OBJECT_COUNTS[mid]+1)))
                self.assertEqual(art.manifest_text(m),(art.MANIFESTS/f'{art.stem(mid)}.manifest.ts').read_text())

    def test_every_committed_pixel_extrusion_unused_blank_and_source_probe(self):
        # Decode actual page files independently of build's target bytearray.
        for mid,result in self.results.items():
            manifest=result['manifest'];pages=[art.decode_source((art.ASSETS/p['image']).read_bytes()) for p in manifest['pages']]
            occupied=[bytearray(w*h) for w,h,_ in pages]
            for image in manifest['images']:
                raw=(art.ASSETS/image['image']).read_bytes();self.assertEqual(art.sha(raw),image['sha256'])
                w,h,source=art.decode_source(raw);self.assertEqual([w,h],image['sourceSizePx'])
                page=image['page'];aw,ah,pixels=pages[page];x,y,rw,rh=image['atlasRectPx'];self.assertEqual([w,h],[rw,rh])
                self.assertTrue(0<=x-2<x+w+2<=aw and 0<=y-2<y+h+2<=ah)
                for dy in range(-2,h+2):
                    sy=min(h-1,max(0,dy));row=source[sy*w*4:(sy+1)*w*4]
                    expected=row[:4]*2+row+row[-4:]*2;start=((y+dy)*aw+x-2)*4
                    self.assertEqual(pixels[start:start+(w+4)*4],expected)
                    start_cell=(y+dy)*aw+x-2
                    self.assertFalse(any(occupied[page][start_cell:start_cell+w+4]),'Extruded source rectangles overlap')
                    occupied[page][start_cell:start_cell+w+4]=bytes([1])*(w+4)
                probe=image['sourceProbe'];px,py=probe['pixelPx'];self.assertTrue(0<=px<w and 0<=py<h)
                at=(py*w+px)*4;self.assertEqual(probe['rgba'],list(source[at:at+4]));self.assertEqual(probe['kind'],'opaque');self.assertEqual(probe['rgba'][3],255)
            for page,(w,h,pixels) in enumerate(pages):
                # Row spans make transparent unused padding verification bounded,
                # rather than allocating one Python object per RGBA texel.
                for y in range(h):
                    x=0
                    while x<w:
                        if occupied[page][y*w+x]:x+=1;continue
                        end=x+1
                        while end<w and not occupied[page][y*w+end]:end+=1
                        self.assertEqual(pixels[(y*w+x)*4:(y*w+end)*4],bytes((end-x)*4));x=end

    def test_actual_panorama_dimensions_hash_pixels_and_probe(self):
        for mid,result in self.results.items():
            for layer,width in [('back',2182 if mid==16 else 1536),('front',2048)]:
                p=result['manifest'][layer];raw=(art.ASSETS/p['image']).read_bytes();w,h,pixels=art.decode_source(raw)
                self.assertEqual([w,h],[width,256]);self.assertEqual(p['sizePx'],[width,256]);self.assertEqual(art.sha(raw),p['sha256'])
                px,py=p['sourceProbe']['pixelPx'];self.assertEqual(p['sourceProbe']['rgba'],list(pixels[(py*w+px)*4:(py*w+px+1)*4]))
                self.assertEqual(p['sourceProbe']['kind'],'opaque');self.assertEqual(p['sourceProbe']['rgba'][3],255)

    def test_goal_reuse_is_source_identity_not_shared_runtime_atlas_or_local_id(self):
        shared=art.old_shared_inputs();self.assertEqual(len(shared),18)
        goal=art.source_objects(art.data_for(16));self.assertEqual(sum((o['sourcePath'],o['sha256']) in shared for o in goal),18)
        if 16 in self.results:
            m=self.results[16]['manifest'];self.assertEqual(sum(x['image'].startswith('art/environments/map01/') for x in m['images']),18)
            self.assertTrue(all(p['image'].startswith('textures/environments/goal-props-') for p in m['pages']))
        self.assertFalse(any((o['sourcePath'],o['sha256']) in shared for o in art.source_objects(art.data_for(2))))

    def test_all_probe_alpha_classes_are_real_not_invented_opaque_texels(self):
        for raw,expected in [(bytes([10,20,30,0,50,60,70,0]),'transparent'),(bytes([10,20,30,64,50,60,70,128]),'alpha'),(bytes([10,20,30,0,50,60,70,255]),'opaque')]:
            p=art.source_probe(2,1,raw);x,y=p['pixelPx'];self.assertEqual(p['kind'],expected);self.assertEqual(p['rgba'],list(raw[(y*2+x)*4:(y*2+x+1)*4]))
        self.assertEqual(art.source_probe(2,1,bytes([10,20,30,64,50,60,70,128]))['rgba'][3],128)

    def test_bad_layout_local_ids_hash_crc_and_committed_paths_reject(self):
        one={'objectId':1,'sourceSizePx':[40,128]}
        for images in [[],[one,one],[{'objectId':False,'sourceSizePx':[1,1]}],[{'objectId':1,'sourceSizePx':[1021,1]}],[{'objectId':1,'sourceSizePx':[1,1277]}],[{'objectId':i,'sourceSizePx':[1020,1276]} for i in (1,2,3)]]:
            with self.assertRaises(ValueError):art.layout(images)
        for change in [lambda d:d['objects'].pop(),lambda d:d['objects'][0].update(id=0),lambda d:d['objects'][0].update(sourcePath='Resources/Maps/MapStartGoal/1.png')]:
            d=copy.deepcopy(art.data_for(2));change(d)
            with self.assertRaises(ValueError):art.source_objects(d)
        d=art.data_for(2)
        with self.assertRaisesRegex(ValueError,'hash mismatch'):art.build(d,lambda path:b'not source pixels')
        raw=bytearray(art.png.encode_png(1,1,bytes([1,2,3,255])));raw[20]^=1
        with self.assertRaisesRegex(ValueError,'CRC'):art.decode_source(raw)
        manifest=copy.deepcopy(self.results[2]['manifest']);manifest['images'][0]['image']='../../outside.png'
        with patch.object(art,'load_manifest',return_value=manifest):
            with self.assertRaisesRegex(ValueError,'Noncanonical'):art.committed_build(2)
        for raw in ['','1','17','2,2','2,wrong']:
            with self.assertRaises(argparse.ArgumentTypeError):art.parse_maps(raw)

    def test_source_guard_and_write_staging_are_explicit(self):
        for replies in [['0'*40],[art.PIN,' M Resources/changed.png']]:
            with patch.object(art.subprocess,'check_output',side_effect=replies):
                with self.assertRaises(ValueError):art.source_guard(Path('/unreadable'))
        self.assertEqual(art.parse_maps('10,2'),[2,10])
        self.assertFalse((art.ASSETS/'textures/environments/map01-props-0.png').exists())

if __name__=='__main__':unittest.main()
