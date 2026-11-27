"""Repository-only checks: source PNGs, generated manifest and atlas agree in CI."""
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import struct
import unittest
import zlib

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('import_player_car_committed',Path(__file__).with_name('import-player-car.py'))
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)

def committed_manifest():
    text=(ROOT/'outrun/src/content/vehicles/ferrari1.manifest.ts').read_text()
    payload=text.split('export const FERRARI1 = ',1)[1]
    data,end=json.JSONDecoder().raw_decode(payload)
    if payload[end:].strip()!='as const;':raise ValueError('Unexpected generated manifest suffix')
    return data

def atlas_rgba(raw):
    # The deterministic atlas writer emits RGBA8 filter-0 rows. Strip those rows
    # directly; do not spend ~1s unfiltering 4 MiB byte-by-byte in every docs gate.
    # CRC/dimensions are checked separately through the normal PNG parser.
    w,h=art.png_info(raw);offset=8;parts=[];header=None
    while offset<len(raw):
        length=struct.unpack('>I',raw[offset:offset+4])[0]
        kind=raw[offset+4:offset+8];payload=raw[offset+8:offset+8+length]
        if kind==b'IHDR':header=struct.unpack('>IIBBBBB',payload)
        if kind==b'IDAT':parts.append(payload)
        offset+=length+12
    rows=zlib.decompress(b''.join(parts));stride=w*4+1
    if header[2:]==(8,6,0,0,0) and len(rows)==h*stride and all(rows[y*stride]==0 for y in range(h)):
        return w,h,b''.join(rows[y*stride+1:(y+1)*stride] for y in range(h))
    return art.decode_png(raw)

class CommittedArtTests(unittest.TestCase):
    def test_manifest_source_pngs_and_packed_pixels_agree_without_upstream(self):
        data=committed_manifest()
        self.assertEqual(data['assetId'],'player-ferrari1')
        self.assertEqual(data['sourceCommit'],art.PIN)
        self.assertEqual([len(data['body']),len(data['effects'])],[148,28])
        atlas_path=ROOT/'outrun/assets'/data['atlas']['image'];raw=atlas_path.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),data['atlas']['sha256'])
        aw,ah,pixels=atlas_rgba(raw)
        self.assertEqual([aw,ah],data['atlas']['sizePx']);self.assertEqual([aw,ah],[1024,1024])
        self.assertEqual(data['atlas']['extrudePx'],2)
        rectangles=[];seen=set()
        for group,folder in [('body','player/ferrari1'),('effects','effects/wheels')]:
            expected_files=set()
            for index,frame in enumerate(data[group],1):
                with self.subTest(frame=frame['id']):
                    self.assertEqual(frame['id'],group+'-%03d'%index)
                    self.assertEqual(frame['sourceFrame'],index)
                    self.assertEqual(frame['image'],'art/vehicles/'+folder+'/c%03d.png'%index)
                    logical=PurePosixPath(frame['image'])
                    self.assertFalse(logical.is_absolute());self.assertNotIn('..',logical.parts)
                    self.assertNotIn(frame['image'],seen);seen.add(frame['image'])
                    source=ROOT/'outrun/assets'/frame['image'];expected_files.add(source)
                    source_raw=source.read_bytes()
                    self.assertEqual(hashlib.sha256(source_raw).hexdigest(),frame['sha256'])
                    w,h,source_pixels=art.decode_png(source_raw) # Includes PNG CRC/color/alpha checks.
                    self.assertEqual([w,h],frame['sourceSizePx'])
                    self.assertEqual(frame['groundAnchorPx'],[w/2,h])
                    self.assertEqual(frame['sourcePlacementAnchorPx'],[w/2,h/4])
                    self.assertEqual(frame['trimPx'],[0,0,w,h])
                    x,y,rw,rh=frame['atlasRectPx'];self.assertEqual([rw,rh],[w,h])
                    self.assertTrue(all(type(v) is int for v in [x,y,rw,rh]))
                    self.assertGreaterEqual(x,2);self.assertGreaterEqual(y,2)
                    self.assertLessEqual(x+w+2,aw);self.assertLessEqual(y+h+2,ah)
                    rect=(x-2,y-2,x+w+2,y+h+2)
                    for ox0,oy0,ox1,oy1 in rectangles:
                        self.assertTrue(rect[2]<=ox0 or rect[0]>=ox1 or rect[3]<=oy0 or rect[1]>=oy1,'Packed/extruded frames overlap')
                    rectangles.append(rect)
                    for row in range(h):
                        a=((y+row)*aw+x)*4;b=row*w*4
                        self.assertEqual(pixels[a:a+w*4],source_pixels[b:b+w*4])
                    # Top/bottom extrusion includes both corner extensions; left/right
                    # strips are checked on each body row as independent packed pixels.
                    for row in range(-2,h+2):
                        sy=min(h-1,max(0,row));start=sy*w*4
                        expected=source_pixels[start:start+4]*2+source_pixels[start:start+w*4]+source_pixels[start+(w-1)*4:start+w*4]*2
                        a=((y+row)*aw+x-2)*4
                        self.assertEqual(pixels[a:a+(w+4)*4],expected)
                    px,py=frame['opaqueProbePx']
                    self.assertTrue(0<=px<w and 0<=py<h)
                    a=(py*w+px)*4
                    self.assertEqual(list(source_pixels[a:a+4]),frame['opaqueProbeRgba'])
                    self.assertEqual(frame['opaqueProbeRgba'][3],255)
            actual=set((ROOT/'outrun/assets/art/vehicles'/folder).glob('*.png'))
            self.assertEqual(actual,expected_files)

if __name__=='__main__':unittest.main()
