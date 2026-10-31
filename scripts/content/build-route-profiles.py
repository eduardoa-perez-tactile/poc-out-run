#!/usr/bin/env python3
"""Verify compact ORIGINAL route tails. Existing gradient0 assets are never rewritten."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct

ROOT=Path(__file__).resolve().parents[2]
P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('route_compiler',P/'convert-map.py')
compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
FORMAT='sourceCompatibility-original-tail-y1-f32bits-v1'
OUTPUT=ROOT/'outrun/assets/data/routes/original-tail-profiles.json'
TAIL_ROWS=1960

def require(condition,message):
    if not condition:raise ValueError('route-profiles: '+message)

def bits(value):
    require(type(value)in(int,float) and math.isfinite(value),'nonfinite tail height')
    result=struct.unpack('<I',struct.pack('<f',value))[0]
    require(struct.unpack('<f',struct.pack('<I',result))[0]==value,'height is not source f32')
    return result

def tail_profile(base,variant,gradient):
    require(type(gradient)is int and gradient in(-1,1),'nonzero gradient must be -1 or 1')
    require(base['forkGradient']==0 and variant['forkGradient']==gradient,'wrong gradient realization')
    for key in base:
        if key not in('forkGradient','segments'):require(variant[key]==base[key],f'unsupported changed metadata {key}')
    count=base['authoredCount']
    require(base['totalCount']-count==TAIL_ROWS and len(variant['segments'])==base['totalCount'],'tail row count changed')
    require(variant['segments'][:count]==base['segments'][:count],'authored geometry changed')
    previous=base['segments'][count-1]['y1'];heights=[]
    for row,(original,selected) in enumerate(zip(base['segments'][count:],variant['segments'][count:]),count):
        require(set(original)==set(selected)=={'y0','y1','curve','gap','mirror','light'},'segment shape changed')
        require(all(selected[key]==original[key] for key in('curve','gap','mirror','light')),f'unsupported changed tail geometry at {row}')
        require(selected['y0']==previous,f'height continuity changed at {row}')
        heights.append(bits(selected['y1']));previous=selected['y1']
    return {'gradient':gradient,'swapLine':variant['swapLine'],'lastLine':variant['lastLine'],'y1Bits':heights}

def build_route_profiles(root=ROOT,source=None):
    root=Path(root);entries=[];source_hashes={}
    for map_id in range(1,17):
        stem='goal' if map_id==16 else f'map{map_id:02}'
        fixture_path=root/f'scripts/content/fixtures/{stem}-source.json';fixture=json.loads(fixture_path.read_text())
        if source is not None:require(compiler.source_fixture(source,map_id)==fixture,f'{stem} pinned source fixture mismatch')
        base=compiler.compile_map(fixture,0,map_id);asset=root/f'outrun/assets/data/biomes/{stem}.json';raw=asset.read_bytes()
        require(compiler.encoded(base).encode()==raw,f'{stem} existing gradient0 bytes changed')
        for path,digest in fixture['implementationSources'].items():
            require(path not in source_hashes or source_hashes[path]==digest,'conflicting source provenance')
            source_hashes[path]=digest
        entries.append({'mapId':map_id,'baseInputSha256':base['inputSha256'],'baseAssetSha256':hashlib.sha256(raw).hexdigest(),
            'authoredCount':base['authoredCount'],'totalCount':base['totalCount'],'segmentLength':base['segmentLength'],
            'profiles':[tail_profile(base,compiler.compile_route_profile(fixture,g,map_id),g)for g in(-1,1)]})
    return {'$type':'SourceBiomeTailProfiles','format':FORMAT,'sourceCommit':compiler.PIN,'sourceHashes':dict(sorted(source_hashes.items())),'entries':entries}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');parser.add_argument('--output',type=Path,default=OUTPUT);parser.add_argument('--source',type=Path)
    args=parser.parse_args();result=build_route_profiles(source=args.source);text=compiler.encoded(result)
    if args.write:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(text)
    else:require(args.output.exists() and args.output.read_text()==text,'output differs; review before explicit --write')
    print(f'16 maps; 32 nonzero profiles; {32*TAIL_ROWS} f32 y1 bit values; {len(text.encode())} bytes; gradient0 assets untouched')

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError)as error:raise SystemExit(str(error))
