"""Build the immutable diagnostic RGBA atlas without image-library dependencies."""
from pathlib import Path
import struct, zlib
W,H=128,64
pixels=bytearray(W*H*4)
def put(x,y,c):
    p=(y*W+x)*4; pixels[p:p+4]=bytes(c)
for y in range(H):
    for x in range(W):
        cell=x//32; u=x%32
        c=None
        if cell==0 and ((5<=u<27 and 3<=y<34) or (13<=u<19 and 34<=y<62)):
            c=(23,147,0,255) if y<22 else (247,223,0,255) if y<42 else (34,34,34,255)
            if 9<=u<15 and 10<=y<18: c=None
        if cell==1 and 3<=u<29 and 18<=y<62:
            c=(230,66,66,255) if y<42 else (247,223,0,255) if y<50 else (34,34,34,255)
            if 9<=u<23 and 23<=y<34: c=(0,148,255,255)
        if cell==2 and 3<=u<29 and 5<=y<62:
            c=(0,128,246,128)
            if 10<=u<20 and 20<=y<33: c=None
        if cell==3 and y>=20+abs(u-16)//2 and y<62: c=(152,120,8,255)
        if c: put(x,y,c)
def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
raw=b''.join(b'\0'+pixels[y*W*4:(y+1)*W*4] for y in range(H))
out=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',W,H,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
Path(__file__).resolve().parents[1].joinpath('assets/textures/hill-proof.png').write_bytes(out)
