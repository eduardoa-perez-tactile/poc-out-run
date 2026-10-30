#!/usr/bin/env python3
"""Deterministic one-car source import. Default checks; --write copies reviewed pixels.
PNG parsing uses only stdlib; original palette+tRNS and RGBA bytes remain unchanged.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import zlib

PIN = '6882721c99bc79365f815f68d389bf5078129e68'
ROOT = Path(__file__).resolve().parents[2]

def require(value, message):
    if not value:
        raise ValueError(message)

def png_info(data):
    require(data[:8] == b'\x89PNG\r\n\x1a\n', 'Invalid PNG signature')
    offset=8; chunks=[]; header=None; alpha=False; palette=False; idat=False
    while offset < len(data):
        require(offset+12 <= len(data), 'Truncated PNG chunk')
        length=struct.unpack('>I',data[offset:offset+4])[0]
        kind=data[offset+4:offset+8];end=offset+8+length
        require(end+4 <= len(data), 'Truncated PNG payload')
        payload=data[offset+8:end]
        require(zlib.crc32(kind+payload)&0xffffffff == struct.unpack('>I',data[end:end+4])[0], 'PNG CRC mismatch')
        require(chunks or kind == b'IHDR', 'PNG IHDR must be first')
        if kind == b'IHDR':
            require(header is None and length == 13, 'Invalid PNG IHDR')
            w,h,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',payload)
            require(0 < w <= 2048 and 0 < h <= 2048, 'Invalid PNG dimensions')
            valid={0:(1,2,4,8,16),2:(8,16),3:(1,2,4,8),4:(8,16),6:(8,16)}
            require(color in valid and depth in valid[color], 'Unsupported PNG color/depth')
            require(compression == filtering == 0 and interlace in (0,1), 'Invalid PNG encoding')
            header=(w,h);alpha=color in (4,6)
        elif kind == b'PLTE':
            require(length > 0 and length % 3 == 0 and length <= 768, 'Invalid PNG palette')
            palette=True
        elif kind == b'tRNS':
            require(color in (0,2,3) and length > 0, 'Invalid PNG transparency')
            alpha=True
        elif kind == b'IDAT': idat=True
        elif kind == b'IEND':
            require(length == 0 and end+4 == len(data), 'Invalid PNG end')
            chunks.append(kind);offset=end+4;break
        chunks.append(kind);offset=end+4
    require(header is not None and idat and chunks[-1:] == [b'IEND'], 'Incomplete PNG')
    require(color != 3 or palette, 'Indexed PNG needs palette')
    require(alpha, 'Vehicle PNG needs alpha or tRNS')
    return header

def decode_png(data):
    w,h=png_info(data)
    offset=8; compressed=[]; palette=b''; transparency=b''
    while offset < len(data):
        length=struct.unpack('>I',data[offset:offset+4])[0]
        kind=data[offset+4:offset+8];payload=data[offset+8:offset+8+length]
        if kind==b'IHDR':_,_,depth,color,_,_,interlace=struct.unpack('>IIBBBBB',payload)
        elif kind==b'PLTE':palette=payload
        elif kind==b'tRNS':transparency=payload
        elif kind==b'IDAT':compressed.append(payload)
        offset+=length+12
    require(interlace==0 and ((color==6 and depth==8) or (color==3 and depth in (4,8))), 'Atlas decoder supports source RGBA8/indexed4/indexed8 only')
    bpp=4 if color==6 else 1
    stride=w*4 if color==6 else (w*depth+7)//8
    try: decoded=zlib.decompress(b''.join(compressed))
    except zlib.error as error:raise ValueError('Invalid PNG compressed pixels') from error
    require(len(decoded)==h*(stride+1),'Invalid PNG scanline size')
    out=bytearray(w*h*4);previous=bytearray(stride)
    for y in range(h):
        start=y*(stride+1);kind=decoded[start];row=bytearray(decoded[start+1:start+1+stride])
        require(kind<=4,'Invalid PNG row filter')
        for x in range(stride):
            a=row[x-bpp] if x>=bpp else 0;b=previous[x];c=previous[x-bpp] if x>=bpp else 0
            if kind==1:predictor=a
            elif kind==2:predictor=b
            elif kind==3:predictor=(a+b)//2
            elif kind==4:
                v=a+b-c;pa,pb,pc=abs(v-a),abs(v-b),abs(v-c)
                predictor=a if pa<=pb and pa<=pc else b if pb<=pc else c
            else:predictor=0
            row[x]=(row[x]+predictor)&255
        for x in range(w):
            at=(y*w+x)*4
            if color==6:out[at:at+4]=row[x*4:x*4+4]
            else:
                index=row[x] if depth==8 else (row[x//2]>>(4 if x%2==0 else 0))&15
                require(index*3+3<=len(palette),'PNG palette index missing')
                out[at:at+4]=palette[index*3:index*3+3]+bytes([transparency[index] if index<len(transparency) else 255])
        previous=row
    return w,h,out

def encode_png(w,h,pixels):
    def chunk(kind,payload):
        return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
    rows=b''.join(b'\0'+pixels[y*w*4:(y+1)*w*4] for y in range(h))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')

def pack_atlas(frames,raw_frames):
    # Deterministic source-order shelves with two extruded texels on each side.
    for width,height in ((512,512),(1024,1024),(2048,1024)):
        x=y=row_height=0;positions=[]
        for frame in frames:
            w,h=frame['sourceSizePx']
            if w+4>width or h+4>height:break
            if x+w+4>width:x=0;y+=row_height;row_height=0
            if y+h+4>height:break
            positions.append((x+2,y+2,w,h));x+=w+4;row_height=max(row_height,h+4)
        if len(positions)==len(frames):break
    require(len(positions)==len(frames),'Selected car exceeds bounded atlas')
    pixels=bytearray(width*height*4)
    for frame,raw,(x,y,w,h) in zip(frames,raw_frames,positions):
        dw,dh,decoded=decode_png(raw);require((dw,dh)==(w,h),'Atlas size mismatch')
        frame['atlasRectPx']=[x,y,w,h];frame['trimPx']=[0,0,w,h]
        opaque=[(abs(px-w/2)+abs(py-h/2),px,py) for py in range(h) for px in range(w) if decoded[(py*w+px)*4+3]==255]
        require(opaque,'Frame has no opaque verification texel')
        _,px,py=min(opaque);at=(py*w+px)*4
        frame['opaqueProbePx']=[px,py];frame['opaqueProbeRgba']=list(decoded[at:at+4])
        for dy in range(-2,h+2):
            sy=min(h-1,max(0,dy))
            for dx in range(-2,w+2):
                sx=min(w-1,max(0,dx));src=(sy*w+sx)*4;dst=((y+dy)*width+x+dx)*4
                pixels[dst:dst+4]=decoded[src:src+4]
    return width,height,encode_png(width,height,pixels)

def source_guard(source):
    def git(*args):
        return subprocess.check_output(['git','-C',str(source),*args],text=True).strip()
    require(git('rev-parse','HEAD') == PIN, 'Source HEAD must match pinned revision')
    require(not git('status','--porcelain=v1','--untracked-files=no','--','Resources'), 'Source Resources has tracked modifications')

def build(source):
    source_guard(source)
    resources=source/'Resources/Vehicles/PlayerCar'
    frames=[];files=[];raw_frames=[]
    for group,folder,count in [('body','Ferraris/Ferrari1',148),('effects','Wheels',28)]:
        for index in range(1,count+1):
            path=resources/folder/('c%d.png'%index)
            raw=path.read_bytes();w,h=png_info(raw);raw_frames.append(raw)
            key='art/vehicles/'+('player/ferrari1' if group=='body' else 'effects/wheels')+'/c%03d.png'%index
            frames.append({'id':group+'-%03d'%index,'image':key,'sourceFrame':index,'sourceSizePx':[w,h],
                           'groundAnchorPx':[w/2,h],'sourcePlacementAnchorPx':[w/2,h/4],
                           'sha256':hashlib.sha256(raw).hexdigest()})
            files.append((path,ROOT/'outrun/assets'/key))
    w,h,atlas=pack_atlas(frames,raw_frames)
    return {'assetId':'player-ferrari1','sourceCommit':PIN,
            'atlas':{'image':'textures/player-ferrari1.png','sizePx':[w,h],'extrudePx':2,
                     'sha256':hashlib.sha256(atlas).hexdigest()},
            'body':frames[:148],'effects':frames[148:]},files,atlas

def manifest_text(data):
    return '// Generated by scripts/art/import-player-car.py; source pixels and anchors, never collision data.\nexport const FERRARI1 = '+json.dumps(data,indent=2)+' as const;\n'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--write',action='store_true')
    args=parser.parse_args()
    data,files,atlas=build(args.source)
    atlas_path=ROOT/'outrun/assets/textures/player-ferrari1.png'
    target=ROOT/'outrun/src/content/vehicles/ferrari1.manifest.ts'
    content=manifest_text(data)
    if args.write:
        for source,destination in files:
            destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination)
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(content)
        atlas_path.parent.mkdir(parents=True,exist_ok=True);atlas_path.write_bytes(atlas)
    else:
        require(atlas_path.exists() and atlas_path.read_bytes()==atlas,'Packed atlas differs')
        require(target.exists() and target.read_text() == content, 'Manifest differs; review then use --write')
        for source,destination in files:
            require(destination.exists() and destination.read_bytes() == source.read_bytes(), 'Imported pixels differ: '+str(destination))
    print(('Imported' if args.write else 'Verified')+' Ferrari1: 148 body + 28 effects; atlas '+str(data['atlas']['sizePx'])+'; no other cars')

if __name__ == '__main__':
    try: main()
    except (ValueError,OSError,subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
