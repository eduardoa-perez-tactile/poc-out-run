#!/usr/bin/env python3
"""Compile an additive immutable route-row dictionary; legacy data stays untouched."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct

ROOT=Path(__file__).resolve().parents[2]
P=Path(__file__).parent
spec=importlib.util.spec_from_file_location('cohort_tail_builder',P/'build-route-profiles.py')
tail_builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(tail_builder)
compiler=tail_builder.compiler
FORMAT='sourceCompatibility-original-row-dictionary-v1'
OUTPUT=ROOT/'outrun/assets/data/routes/original-route-cohort.json'
FIELDS=('y0','y1','curve','gap','mirror','light')

def require(condition,message):
    if not condition:raise ValueError('route-cohort: '+message)

def row_key(row):
    """Exact numeric identity, including signed zero; no rounded height keys."""
    require(set(row)==set(FIELDS),'unexpected row shape')
    for name in FIELDS[:4]:
        require(type(row[name])in(int,float) and math.isfinite(row[name]),'nonfinite or nonnumeric row field')
    require(type(row['mirror'])is bool and type(row['light'])is int,'invalid mirror/light')
    return tuple(struct.pack('<d',row[name])for name in FIELDS[:4])+(row['mirror'],row['light'])

def build_route_cohort(root=ROOT,source=None):
    root=Path(root)
    # This independently recompiles every profile from the pinned source fixtures
    # and requires byte-identical legacy gradient0 assets before using the codec.
    tails=tail_builder.build_route_profiles(root,source)
    tail_path=root/'outrun/assets/data/routes/original-tail-profiles.json'
    require(tail_path.read_bytes()==compiler.encoded(tails).encode(),'committed tail codec differs from pinned source')
    rows=[];indices={};entries=[]
    def intern(row):
        key=row_key(row)
        if key not in indices:
            indices[key]=len(rows);rows.append(dict(row))
        return indices[key]
    for entry in tails['entries']:
        map_id=entry['mapId'];stem='goal'if map_id==16 else f'map{map_id:02}'
        path=root/f'outrun/assets/data/biomes/{stem}.json';raw=path.read_bytes();base=json.loads(raw)
        require(hashlib.sha256(raw).hexdigest()==entry['baseAssetSha256'],'base asset provenance changed')
        base_rows=[intern(row)for row in base['segments']];profiles=[]
        for profile in entry['profiles']:
            previous=base['segments'][base['authoredCount']-1]['y1'];tail_rows=[]
            for offset,bits in enumerate(profile['y1Bits']):
                y1=struct.unpack('<f',struct.pack('<I',bits))[0]
                original=base['segments'][base['authoredCount']+offset]
                tail_rows.append(intern({**original,'y0':previous,'y1':y1}));previous=y1
            profiles.append({'gradient':profile['gradient'],'tailRows':tail_rows})
        entries.append({'base':{key:value for key,value in base.items()if key not in('segments','$type')},
            'baseAssetSha256':entry['baseAssetSha256'],'baseRows':base_rows,'profiles':profiles})
    return {'$type':'SourceRouteCohort','format':FORMAT,'sourceCommit':compiler.PIN,
        'sourceHashes':tails['sourceHashes'],'rows':rows,'entries':entries}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');parser.add_argument('--output',type=Path,default=OUTPUT);parser.add_argument('--source',type=Path)
    args=parser.parse_args();result=build_route_cohort(source=args.source);text=compiler.encoded(result)
    if args.write:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(text)
    else:require(args.output.exists()and args.output.read_text()==text,'output differs; review before explicit --write')
    print(f'16 maps; 48 profiles; {len(result["rows"])} shared rows; {len(text.encode())} bytes; legacy assets untouched')

if __name__=='__main__':
    try:main()
    except(ValueError,OSError,KeyError)as error:raise SystemExit(str(error))
