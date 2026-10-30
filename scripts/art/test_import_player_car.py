"""Offline parser checks; no engine/API/source checkout required."""
import importlib.util
import struct
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('import_player_car',Path(__file__).with_name('import-player-car.py'))
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
def chunk(kind,payload):
    return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
def image(color=6,depth=8,transparency=False):
    raw=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,depth,color,0,0,0))
    if color==3:raw+=chunk(b'PLTE',b'\xff\x00\x00')
    if transparency:raw+=chunk(b'tRNS',b'\x00')
    return raw+chunk(b'IDAT',zlib.compress(b'\x00\x00\x00\x00\x00'))+chunk(b'IEND',b'')
class ParserTests(unittest.TestCase):
    def test_rgba_and_indexed_alpha_are_accepted(self):
        self.assertEqual(art.png_info(image()),(1,1))
        self.assertEqual(art.png_info(image(3,4,True)),(1,1))
    def test_opaque_art_rejected(self):
        with self.assertRaisesRegex(ValueError,'alpha'):art.png_info(image(2))
    def test_invalid_crc_rejected(self):
        data=bytearray(image());data[20]^=1
        with self.assertRaisesRegex(ValueError,'CRC'):art.png_info(data)
    def test_truncated_and_trailing_payload_rejected(self):
        for raw in (image()[:-1],image()+b'trailing'):
            with self.subTest(raw=raw[-8:]),self.assertRaises(ValueError):art.png_info(raw)
    def test_invalid_color_depth_rejected(self):
        with self.assertRaisesRegex(ValueError,'color/depth'):art.png_info(image(6,4))
    def test_rgba_decoder_restores_all_five_png_filters(self):
        rows=[bytes([10,20,30,40,50,60,70,80]),bytes([11,22,33,44,55,66,77,88])]
        for kind in range(5):
            encoded=bytearray();previous=bytes(8)
            for row in rows:
                encoded.append(kind)
                for i,value in enumerate(row):
                    a=row[i-4] if i>=4 else 0;b=previous[i];c=previous[i-4] if i>=4 else 0
                    if kind==1:predictor=a
                    elif kind==2:predictor=b
                    elif kind==3:predictor=(a+b)//2
                    elif kind==4:
                        v=a+b-c;dist=[abs(v-a),abs(v-b),abs(v-c)]
                        predictor=[a,b,c][dist.index(min(dist))]
                    else:predictor=0
                    encoded.append((value-predictor)&255)
                previous=row
            raw=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,2,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(encoded))+chunk(b'IEND',b'')
            with self.subTest(filter=kind):
                w,h,pixels=art.decode_png(raw)
                self.assertEqual((w,h,pixels),(2,2,bytearray(b''.join(rows))))
    def test_indexed_four_bit_transparency_decodes_each_nibble(self):
        raw=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,1,4,3,0,0,0))
        raw+=chunk(b'PLTE',bytes([255,0,0,0,255,0]))+chunk(b'tRNS',bytes([0,127]))
        raw+=chunk(b'IDAT',zlib.compress(bytes([0,0x01])))+chunk(b'IEND',b'')
        self.assertEqual(art.decode_png(raw)[2],bytes([255,0,0,0,0,255,0,127]))
    def test_packing_preserves_pixels_source_rect_and_extruded_edges(self):
        pixels=bytes([1,2,3,255,4,5,6,127]);raw=art.encode_png(2,1,pixels)
        frames=[{'sourceSizePx':[2,1]}]
        w,h,atlas=art.pack_atlas(frames,[raw]);_,_,out=art.decode_png(atlas)
        self.assertEqual((w,h),(512,512));self.assertEqual(frames[0]['atlasRectPx'],[2,2,2,1])
        self.assertEqual(frames[0]['trimPx'],[0,0,2,1]);self.assertEqual(frames[0]['opaqueProbeRgba'],[1,2,3,255])
        for y in range(5):
            for x in range(6):
                expected=pixels[:4] if x<3 else pixels[4:]
                self.assertEqual(out[(y*w+x)*4:(y*w+x+1)*4],expected)
    def test_oversized_frame_cannot_overflow_bounded_atlas(self):
        with self.assertRaisesRegex(ValueError,'bounded atlas'):
            art.pack_atlas([{'sourceSizePx':[2048,2048]}],[b'not decoded'])
    def test_corrupt_decompressed_scanlines_rejected(self):
        raw=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,1,8,6,0,0,0))
        raw+=chunk(b'IDAT',zlib.compress(b'\0'))+chunk(b'IEND',b'')
        with self.assertRaisesRegex(ValueError,'scanline'):art.decode_png(raw)
    def test_wrong_commit_rejected_before_resources_are_read(self):
        with patch.object(art.subprocess,'check_output',return_value='0'*40):
            with self.assertRaisesRegex(ValueError,'HEAD'):art.build(Path('/unreadable'))
    def test_dirty_resources_rejected_before_pixels_read(self):
        with patch.object(art.subprocess,'check_output',side_effect=[art.PIN,' M Resources/car.png']):
            with self.assertRaisesRegex(ValueError,'tracked modifications'):art.build(Path('/unreadable'))
if __name__=='__main__':unittest.main()
