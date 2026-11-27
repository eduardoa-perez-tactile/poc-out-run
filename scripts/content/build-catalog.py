#!/usr/bin/env python3
"""Verify or explicitly write the complete ORIGINAL gradient-0 source graph."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PIN='6882721c99bc79365f815f68d389bf5078129e68'
ROWS=((1,),(2,3),(4,5,6),(7,8,9,10),(11,12,13,14,15))
OUTPUT=ROOT/'outrun/assets/data/biome-catalog.json'

def require(value,path,message):
    if not value:raise ValueError(f'{path}:1:1: {message}')

def build_catalog(root=ROOT):
    goal_fixture_path=root/'scripts/content/fixtures/goal-source.json'
    fixture=json.loads(goal_fixture_path.read_text())
    policy=fixture['goalPolicy']
    require(fixture['sourceCommit']==PIN,goal_fixture_path,'wrong source commit')
    require(all(type(policy[k]) is int for k in ['id','checkpointLine','terrain','roadTerrain','seed']),
            goal_fixture_path,'goal integer policy fields cannot be booleans or other types')
    require(policy['id']==16 and policy['checkpointLine']==-1 and policy['terrain']==1 and policy['roadTerrain']==0,
            goal_fixture_path,'goal semantic/terrain adaptation mismatch')
    require(policy['terrainProfile']=='goal-terrain-defaults-v1' and policy['randomProfile']=='goal-offsets-sha256-u24-v1' and policy['seed']==0,
            goal_fixture_path,'unknown deterministic goal policy')
    entries=[]
    for stage,row in enumerate(ROWS,1):
        for position,map_id in enumerate(row):
            next_row=ROWS[stage] if stage<5 else (16,)*6
            links={'left':next_row[position],'right':next_row[position+1],'sequential':map_id+1}
            entries.append(_entry(root,map_id,'ordinary',stage,position,links))
    entries.append(_entry(root,16,'goal',6,0,{'left':-1,'right':-1,'sequential':-1}))
    goal_path=root/'outrun/assets/data/biomes/goal.json'
    goal=json.loads(goal_path.read_text())
    fixture_hash=hashlib.sha256(json.dumps(fixture,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    require(goal['inputSha256']==fixture_hash,goal_path,'goal fixture changed since the data was compiled')
    return {'$type':'SourceBiomeCatalog','sourceCommit':PIN,
            'sourceHashes':dict(fixture['implementationSources']),
            'profile':'sourceCompatibility-original','forkGradient':0,
            'goalPolicy':{key:policy[key] for key in ['randomProfile','seed','terrainProfile','terrain','roadTerrain']},
            'entries':entries}

def _entry(root,map_id,kind,stage,position,links):
    key=f'data/biomes/map{map_id:02}.json' if kind=='ordinary' else 'data/biomes/goal.json'
    path=root/'outrun/assets'/key
    data=json.loads(path.read_text())
    require(data['$type']=='SourceBiome' and type(data['id']) is int and data['id']==map_id and data['sourceCommit']==PIN,path,'wrong biome identity')
    require(data['profile']=='sourceCompatibility-original' and type(data['forkGradient']) is int and data['forkGradient']==0,path,'wrong compatibility realization')
    require(data['links']==links,path,'source graph mismatch')
    checkpoint=data['checkpointLine']
    require(checkpoint==(-1 if map_id in (1,16) else 203 if map_id in (2,3,14,15) else 202),path,'checkpoint semantics mismatch')
    if kind=='goal':
        require(data['terrain']==1 and data['roadTerrain']==0 and data['authoredCount']==1050 and data['totalCount']==3010,
                path,'goal adaptation/entry geometry mismatch')
    return {'id':map_id,'kind':kind,'stage':stage,'position':position,'dataKey':key,
            'terminal':kind=='goal','hasCheckpoint':checkpoint>=0,'checkpointLine':checkpoint,'links':links}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write',action='store_true')
    args=parser.parse_args()
    result=build_catalog()
    text=json.dumps(result,separators=(',',':'),allow_nan=False)+'\n'
    if args.write:OUTPUT.write_text(text)
    else:require(OUTPUT.exists() and OUTPUT.read_text()==text,OUTPUT,'catalog differs; review before --write')
    print(f'16 source nodes; 15 ordinary + genuine terminal goal; {len(text.encode())} bytes')

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError) as error:raise SystemExit(str(error))
