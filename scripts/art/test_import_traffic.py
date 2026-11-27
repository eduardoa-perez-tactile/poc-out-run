"""Complete traffic import checks using committed inputs, stdlib and no upstream."""
import importlib.util
from pathlib import Path
import struct
import unittest
from unittest.mock import patch
import zlib

spec=importlib.util.spec_from_file_location('traffic_import',Path(__file__).with_name('import-traffic.py'))
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)

def atlas_pixels(raw):
    w,h=art.png.png_info(raw);offset=8;parts=[]
    while offset<len(raw):
        length=struct.unpack('>I',raw[offset:offset+4])[0];kind=raw[offset+4:offset+8]
        if kind==b'IDAT':parts.append(raw[offset+8:offset+8+length])
        offset+=length+12
    rows=zlib.decompress(b''.join(parts));stride=w*4+1
    if len(rows)!=h*stride or any(rows[y*stride]!=0 for y in range(h)):raise ValueError('Expected generated filter0 atlas')
    return w,h,b''.join(rows[y*stride+1:(y+1)*stride] for y in range(h))

class TrafficImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.values=art.committed_build();cls.catalog=cls.values[0]
    def test_complete_original_catalog_hashes_scales_anchors_and_frame_pairs(self):
        data=self.catalog;self.assertEqual(data['assetId'],'traffic-source');self.assertEqual(data['sourceCommit'],art.PIN)
        self.assertEqual([m['id'] for m in data['models']],list(range(1,33)))
        seen=set()
        for model in data['models']:
            m=model['id'];prop=(art.ROOT/'outrun'/art.raw_properties_path(m)).read_bytes()
            self.assertEqual(model['propertiesSha256'],art.sha(prop));self.assertEqual(model['scale'],.9 if m in (1,7,13,19,25) else 1.3)
            self.assertEqual([f['sourceFrame'] for f in model['frames']],list(range(1,17)))
            for frame in model['frames']:
                f=frame['sourceFrame'];self.assertEqual(frame['image'],art.raw_path(m,f));self.assertEqual(frame['sourcePath'],art.source_path(m,f))
                self.assertNotIn(frame['image'],seen);seen.add(frame['image'])
                raw=(art.ROOT/'outrun'/frame['image']).read_bytes();w,h,pixels=art.png.decode_png(raw)
                self.assertEqual(frame['sha256'],art.sha(raw));self.assertEqual(frame['sourceSizePx'],[w,h]);self.assertEqual(frame['groundAnchorPx'],[w/2,h])
                self.assertIn(0,pixels[3::4]);self.assertIn(255,pixels[3::4])
                x,y=frame['opaqueProbePx'];self.assertTrue(0<=x<w and 0<=y<h)
                self.assertEqual(frame['opaqueProbeRgba'],list(pixels[(y*w+x)*4:(y*w+x+1)*4]));self.assertEqual(frame['opaqueProbeRgba'][3],255)
            # Each numbered pose has two real source references, not reused frame IDs.
            for first in range(0,16,2):
                a,b=model['frames'][first:first+2];self.assertEqual(b['sourceFrame'],a['sourceFrame']+1)
                self.assertNotEqual(a['image'],b['image']);self.assertEqual(a['sourceSizePx'],b['sourceSizePx'])
        self.assertEqual(len(seen),512)
    def test_all_atlas_pixels_extrusion_bounds_and_nonoverlap(self):
        data=self.catalog;raw=(art.ROOT/'outrun/assets'/data['atlas']['image']).read_bytes();w,h,pixels=atlas_pixels(raw)
        self.assertEqual((w,h),(1024,1280));self.assertEqual(data['atlas']['extrudePx'],2);self.assertEqual(art.sha(raw),data['atlas']['sha256'])
        occupancy=bytearray(w*h)
        for model in data['models']:
            for frame in model['frames']:
                x,y,fw,fh=frame['atlasRectPx'];self.assertEqual([fw,fh],frame['sourceSizePx'])
                self.assertTrue(x>=2 and y>=2 and x+fw+2<=w and y+fh+2<=h)
                _,_,source=art.png.decode_png(self.values[1][(model['id'],frame['sourceFrame'])])
                for dy in range(-2,fh+2):
                    start=(y+dy)*w+x-2;self.assertFalse(any(occupancy[start:start+fw+4]));occupancy[start:start+fw+4]=b'\1'*(fw+4)
                    sy=max(0,min(fh-1,dy));row=source[sy*fw*4:(sy+1)*fw*4];expected=row[:4]*2+row+row[-4:]*2
                    self.assertEqual(pixels[start*4:(start+fw+4)*4],expected)
        # Deterministic reconstruction below also checks every unused transparent texel.
        self.assertEqual(raw,self.values[3])
    def test_full_catalog_fits_without_repacking_and_leaves_room_in_default_upload_budget(self):
        frames=[{'modelId':m['id'],**frame} for m in self.catalog['models'] for frame in m['frames']]
        compact=art.layout(frames)
        with patch.object(art,'HEIGHT',2048):
            original=art.layout(frames);old_values=art.committed_build()
        self.assertEqual(compact,original) # Lowering blank padding cannot move any source rectangle.
        self.assertEqual(self.catalog['models'],old_values[0]['models'])
        old_w,old_h,old_pixels=atlas_pixels(old_values[3])
        new_w,new_h,new_pixels=atlas_pixels(self.values[3])
        self.assertEqual((old_w,old_h,new_w,new_h),(1024,2048,1024,1280))
        self.assertEqual(new_pixels,old_pixels[:new_w*new_h*4])
        self.assertFalse(any(old_pixels[new_w*new_h*4:]))
        packed_end=max(y+h+art.EXTRUDE for x,y,w,h in compact.values())
        self.assertEqual(packed_end,1241);self.assertLessEqual(packed_end,1280)
        w,h,pixels=atlas_pixels(self.values[3]);self.assertEqual(h-packed_end,39)
        self.assertFalse(any(pixels[packed_end*w*4:]))
        self.assertEqual(w*h*4,5*1024*1024)
        # A texture exactly8MiB can starve behind a changing road at that frame budget.
        self.assertLess(w*h*4,8*1024*1024)
    def test_manifest_atlas_and_input_inventory_are_deterministic(self):
        art.verify(*self.values)
        repeated=art.committed_build();self.assertEqual(repeated,self.values)
        self.assertEqual(art.MANIFEST.read_text(),art.manifest_text(self.catalog))
        self.assertIn('readonly frames:readonly TrafficFrame[]',art.MANIFEST.read_text())
    def test_layout_does_not_depend_on_input_iteration_order(self):
        frames=[{'modelId':m['id'],**frame} for m in self.catalog['models'] for frame in m['frames']]
        self.assertEqual(art.layout(frames),art.layout(list(reversed(frames))))
    def test_layout_rejects_duplicate_invalid_and_overflowing_frames(self):
        frame={'modelId':1,'sourceFrame':1,'sourceSizePx':[58,43]}
        for frames in ([],[frame,frame],[{**frame,'sourceSizePx':[0,43]}],[{**frame,'sourceSizePx':[1024,43]}],
                       [{'modelId':m,'sourceFrame':1,'sourceSizePx':[1000,1000]} for m in range(1,4)]):
            with self.subTest(frames=frames),self.assertRaises(ValueError):art.layout(frames)
    def test_source_guard_rejects_wrong_commit_and_resources_or_code_modifications(self):
        with patch.object(art.subprocess,'check_output',return_value='wrong\n'),self.assertRaisesRegex(ValueError,'HEAD'):art.source_guard(Path('/fake'))
        for dirty in [' M Resources/Vehicles/TrafficCars/Car1/c1.png\n',' M src/Car/TrafficCar/TrafficCar.cpp\n']:
            with patch.object(art.subprocess,'check_output',side_effect=[art.PIN+'\n',dirty]) as command,self.assertRaisesRegex(ValueError,'modifications'):
                art.source_guard(Path('/fake'))
            self.assertEqual(command.call_args_list[1].args[0][-2:],['Resources','src'])
        with patch.object(art.subprocess,'check_output',side_effect=[art.PIN+'\n','']):art.source_guard(Path('/fake'))
    def test_properties_and_corrupt_or_missing_source_frames_fail_visibly(self):
        for raw,model in [(b'SCALE: 0.8',1),(b'SCALE: 1.3',1),(b'SCALE: 0.9 extra',1),(b'SCALE: nan',2)]:
            with self.subTest(raw=raw),self.assertRaises(ValueError):art.scale_property(raw,model)
        def read(path):
            if path.endswith('.txt'):return b'SCALE: 0.9'
            raw=bytearray(self.values[1][(1,1)]);raw[20]^=1;return raw
        with self.assertRaisesRegex(ValueError,'CRC'):art.build(read)
        with self.assertRaises(FileNotFoundError):art.build(lambda path:(_ for _ in ()).throw(FileNotFoundError(path)))
    def test_atomic_publication_preserves_old_file_when_replacement_fails(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'catalog.ts';path.write_bytes(b'old-complete')
            with patch.object(art.os,'replace',side_effect=OSError('blocked')),self.assertRaises(OSError):art.atomic_write(path,b'new-complete')
            self.assertEqual(path.read_bytes(),b'old-complete');self.assertEqual(list(Path(directory).iterdir()),[path])
            art.atomic_write(path,b'new-complete');self.assertEqual(path.read_bytes(),b'new-complete')
    def test_reference_all512_controls_equal_decoded_original_pixels_not_catalog_or_atlas(self):
        import copy
        catalog=copy.deepcopy(self.catalog)
        # Corrupt recorded color and atlas coordinates: neither may supply the
        # reference pixels. Original files and source probe coordinates do.
        for model in catalog['models']:
            for frame in model['frames']:
                frame['opaqueProbeRgba']=[1,2,3,4];frame['atlasRectPx']=[0,0,1,1]
        raw=art.reference_png(catalog,self.values[1]);self.assertEqual(raw,art.REFERENCE.read_bytes())
        w,h,pixels=art.png.decode_png(raw);self.assertEqual((w,h),(32,16));self.assertEqual(set(pixels[3::4]),{255})
        for model in self.catalog['models']:
            for frame in model['frames']:
                sw,sh,source=art.png.decode_png(self.values[1][(model['id'],frame['sourceFrame'])]);x,y=frame['opaqueProbePx']
                at=((frame['sourceFrame']-1)*32+model['id']-1)*4
                self.assertEqual(pixels[at:at+4],source[(y*sw+x)*4:(y*sw+x+1)*4])
        self.assertEqual(art.reference_png(catalog,self.values[1]),raw)
    def test_reference_missing_corrupt_and_invalid_probe_fail(self):
        import copy
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'reference.png'
            with patch.object(art,'REFERENCE',path),self.assertRaises(FileNotFoundError):art.verify(*self.values)
            path.write_bytes(b'corrupt')
            with patch.object(art,'REFERENCE',path),self.assertRaisesRegex(ValueError,'reference differs'):art.verify(*self.values)
        for probe in [[-1,0],[0,10000]]:
            catalog=copy.deepcopy(self.catalog);catalog['models'][0]['frames'][0]['opaqueProbePx']=probe
            with self.assertRaisesRegex(ValueError,'coordinate'):art.reference_png(catalog,self.values[1])

if __name__=='__main__':unittest.main()
