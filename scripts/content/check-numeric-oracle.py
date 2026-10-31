"""Optional extracted C++ arithmetic comparison; normal CI consumes recorded samples.
clang++ -std=c++17 -O0 -ffp-contract=off scripts/content/numeric-oracle.cpp -o /tmp/map01-numeric-oracle
python3 scripts/content/check-numeric-oracle.py --binary /tmp/map01-numeric-oracle
Add --map 2 or --map 3 for full-row checks against the separately captured map-specific pairs.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import platform
import re
import struct
import subprocess
from pathlib import Path
P=Path(__file__).parent
ROOT=P.resolve().parents[1]
spec=importlib.util.spec_from_file_location('compiler',P/'convert-map.py');compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
f32=lambda x:struct.unpack('<f',struct.pack('<f',float(x)))[0]
FIELDS=('y0','y1','curve','gap')

def independent_commands(fixture,gradient=0):
    """Parse SOURCE operands, not compiler geometry/commands, for the C++ diagnostic."""
    if type(gradient)is not int or gradient not in(-1,0,1):raise ValueError('invalid route gradient')
    commands=[];section=False
    if 'mapText' not in fixture:
        base=fixture['sourceRecipe']['biome']['text']
        calls=re.findall(r'\baddBiome\(([^;]+)\)\s*;',base)
        if len(calls)!=1 or [v.strip() for v in calls[0].split(',')]!=['350','350','350','0','0','false','false','threeTracksDistance','not_count_lines']:
            raise ValueError('unsupported goal source base operands')
        commands=['350 350 350 0 0 0 0']

    for line in fixture.get('mapText','').splitlines():
        t=line.split()
        if not t:continue
        if t[0]=='START_RELIEF':section=True;continue
        if t[0]=='SPRITES':break
        if not section:continue
        name=t[0];a=list(map(float,t[1:]));e,h,l=map(int,a[:3]);curve=slope=mirror=0
        if name=='STRAIGHT:':mirror,tracks=a[3:]
        elif name.startswith('CURVE_'):curve,mirror,tracks,factor=a[3:];h=int(h*factor)
        elif name=='HILL_STRAIGHT:':slope,tracks,factor=a[3:];h=int(h*factor)
        elif name in ('HILL_LEFT:','HILL_RIGHT:'):slope,curve,mirror,tracks=a[3:];l=e
        else:raise ValueError('unknown source relief '+name)
        gap={3:0,4:1036,5:2072,6:3108,7:4144,8:5180,2:24756}[tracks]
        commands.append(f'{e} {h} {l} {curve} {slope} {int(mirror)} {gap}')
    # Source ORIGINAL append, Map.cpp498-526; independent SOURCE operands.
    commands+=[f'10 300 50 -2 {gradient*80} 1 0','100 100 100 0 0 1 24756','100 100 100 0 0 0 2072','100 150 150 0 0 0 0','100 100 100 0 0 0 0','100 100 100 0 0 0 0']
    return '\n'.join(commands)+'\n'

def declared_pairs(reference,map_id):
    pairs={}
    for pair in reference['differences']:
        key=(pair['map'],pair['row'],pair['field'])
        if key[0]!=map_id or key[2] not in FIELDS or type(key[1])is not int or key[1]<0 or key in pairs:
            raise ValueError('invalid/duplicate map-specific numeric pair')
        if pair['ported']==pair['source']:raise ValueError('declared pair must differ')
        pairs[key]=(pair['ported'],pair['source'])
    return pairs

def compare_map_rows(data,source_rows,reference,map_id):
    """All fields exact except the EXACT independently captured operand/value pairs."""
    allowed=declared_pairs(reference,map_id);seen=set();lines=source_rows.splitlines()
    if len(lines)!=data['totalCount']:raise ValueError('Oracle row count mismatch')
    for row,line in enumerate(lines):
        values=line.split()
        if len(values)!=5 or int(values[0])!=row:raise ValueError('Oracle row/order mismatch')
        for field,source in zip(FIELDS,map(f32,values[1:])):
            ported=data['segments'][row][field];key=(map_id,row,field)
            if key in allowed:
                if (ported,source)!=allowed[key]:raise ValueError(f'declared numeric pair changed: {key}')
                seen.add(key)
            elif ported!=source:raise ValueError(f'undeclared numeric difference: {key}')
    if seen!=set(allowed):raise ValueError('missing declared numeric pairs')
    return len(seen)

def route_numeric_result(binary,map_id,gradient):
    stem='goal' if map_id==16 else f'map{map_id:02}'
    fixture_path=P/f'fixtures/{stem}-source.json';raw=fixture_path.read_bytes();fixture=json.loads(raw)
    commands=independent_commands(fixture,gradient)
    result=subprocess.run([str(binary)],input=commands,text=True,capture_output=True,check=True)
    data=compiler.compile_route_profile(fixture,gradient,map_id)
    lines=result.stdout.splitlines()
    if len(lines)!=data['totalCount']:raise ValueError('route oracle row count mismatch')
    differences=[]
    for row,line in enumerate(lines):
        values=line.split()
        if len(values)!=5 or int(values[0])!=row:raise ValueError('route oracle row/order mismatch')
        for field,source in zip(FIELDS,map(f32,values[1:])):
            ported=data['segments'][row][field]
            if source!=ported:
                integer=lambda x:struct.unpack('<I',struct.pack('<f',x))[0]
                differences.append({'row':row,'field':field,'ported':ported,'source':source,'ulp':abs(integer(ported)-integer(source))})
    record={'map':map_id,'gradient':gradient,'totalRows':data['totalCount'],'authoredRows':data['authoredCount'],
        'sourceFixtureSha256':hashlib.sha256(raw).hexdigest(),'commandStreamSha256':hashlib.sha256(commands.encode()).hexdigest(),
        'rawCppRowsSha256':hashlib.sha256(result.stdout.encode()).hexdigest(),'differences':differences}
    if map_id==16:record['sourceRecipeSha256']={key:hashlib.sha256(fixture['sourceRecipe'][key]['text'].encode()).hexdigest()for key in('logger','biome')}
    else:record['sourceMapSha256']=hashlib.sha256(fixture['mapText'].encode()).hexdigest()
    return record,data

def validate_route_pairs(data,source_rows,record):
    """No tolerances: every declared exact pair must be encountered exactly once."""
    required={'row','field','ported','source','ulp'};allowed={}
    for pair in record['differences']:
        if set(pair)!=required:raise ValueError('invalid route numeric pair shape')
        key=(pair['row'],pair['field'])
        if type(key[0])is not int or not 0<=key[0]<data['totalCount'] or key[1]not in FIELDS or key in allowed:raise ValueError('invalid/duplicate route numeric pair')
        a,b=pair['ported'],pair['source']
        if any(type(x)not in(int,float) or not math.isfinite(x) or f32(x)!=x for x in(a,b)) or a==b:raise ValueError('invalid route exact values')
        integer=lambda x:struct.unpack('<I',struct.pack('<f',x))[0]
        if type(pair['ulp'])is not int or pair['ulp']!=abs(integer(a)-integer(b)):raise ValueError('route ULP provenance mismatch')
        allowed[key]=(a,b)
    seen=set();lines=source_rows.splitlines()
    if len(lines)!=data['totalCount']:raise ValueError('route oracle row count mismatch')
    for row,line in enumerate(lines):
        values=line.split()
        if len(values)!=5 or int(values[0])!=row:raise ValueError('route oracle row/order mismatch')
        for field,source in zip(FIELDS,map(f32,values[1:])):
            ported=data['segments'][row][field];key=(row,field)
            if key in allowed:
                if(ported,source)!=allowed[key]:raise ValueError(f'route declared pair changed: {key}')
                seen.add(key)
            elif ported!=source:raise ValueError(f'route undeclared difference: {key}')
    if seen!=set(allowed):raise ValueError('route missing declared pair')
    return len(seen)

def check_route_profiles(binary,reference):
    if reference['sourceCommit']!=compiler.PIN or reference['kernelSha256']!=hashlib.sha256((ROOT/reference['kernel']).read_bytes()).hexdigest():raise ValueError('route source/kernel provenance mismatch')
    records=reference['profiles']
    if len(records)!=48 or [(r['map'],r['gradient'])for r in records]!=[(i,g)for i in range(1,17)for g in(-1,0,1)]:raise ValueError('route capture membership/order mismatch')
    rows=pairs=0
    for record in records:
        actual,data=route_numeric_result(binary,record['map'],record['gradient'])
        # Exact capture comparison includes raw C++ output/independent command SHA;
        # a different compiler/libm must produce reviewed NEW evidence, not tolerance.
        if actual!=record:raise ValueError(f'route exact capture mismatch map{record["map"]} gradient{record["gradient"]}')
        rows+=data['totalCount'];pairs+=len(actual['differences'])
    return rows,pairs

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--binary',required=True)
    parser.add_argument('--map',type=int,choices=range(1,17),default=1)
    parser.add_argument('--route-profiles',action='store_true',help='All48 source-derived route profiles; default Map1 policy unchanged')
    args=parser.parse_args()
    if args.route_profiles:
        reference=json.loads((P/'fixtures/route-profiles-numeric.json').read_text());rows,pairs=check_route_profiles(args.binary,reference)
        print(f'48 ORIGINAL profiles / {rows} rows / all4fields; {pairs} EXACT captured differences, no generic tolerance; extracted arithmetic diagnostic only')
        return
    if args.map!=1:
        stem='goal' if args.map==16 else f'map{args.map:02}'
        fixture=json.loads((P/f'fixtures/{stem}-source.json').read_text())
        capture_file='maps23-numeric.json' if args.map in (2,3) else 'remaining-catalog-numeric.json'
        captured=json.loads((P/'fixtures'/capture_file).read_text());reference=captured['maps'][str(args.map)]
        commands=independent_commands(fixture)
        if captured['sourceCommit']!=compiler.PIN or captured['kernelSha256']!=hashlib.sha256((ROOT/captured['kernel']).read_bytes()).hexdigest():raise ValueError('numeric capture source/kernel mismatch')
        if args.map==16:
            if {k:hashlib.sha256(fixture['sourceRecipe'][k]['text'].encode()).hexdigest() for k in ('logger','biome')}!=reference['sourceRecipeSha256']:raise ValueError('numeric capture goal source mismatch')
        elif hashlib.sha256(fixture['mapText'].encode()).hexdigest()!=reference['sourceMapSha256']:raise ValueError('numeric capture map source mismatch')
        if hashlib.sha256(commands.encode()).hexdigest()!=reference['commandStreamSha256']:raise ValueError('numeric capture source command mismatch')
        result=subprocess.run([args.binary],input=commands,text=True,capture_output=True,check=True)
        data=compiler.compile_map(fixture,0,args.map);different=compare_map_rows(data,result.stdout,reference,args.map)
        print(f"Map{args.map}: {data['totalCount']} rows/all4fields; {different} exact declared field differences; no generic tolerance or original-game-run claim")
        return
    # Preserve the established default Map1 source-oracle comparison and policy.
    data=json.loads((ROOT/'outrun/assets/data/biomes/map01.json').read_text())
    gaps={3:0,4:1036,5:2072,6:3108,7:4144,8:5180,2:24756};commands=[]
    for command in data['commands']:
        a=command['arguments'];e,h,l=command['effective'];name=command['command'];curve=slope=mirror=0
        if name=='STRAIGHT':mirror,tracks=a[3:]
        elif name.startswith('CURVE'):curve,mirror,tracks,_=a[3:]
        elif name=='HILL_STRAIGHT':slope,tracks,_=a[3:]
        else:slope,curve,mirror,tracks=a[3:]
        commands.append(f'{e} {h} {l} {curve} {slope} {int(mirror)} {gaps[tracks]}')
    commands += [f'10 300 50 -2 {data["forkGradient"]*80} 1 0','100 100 100 0 0 1 24756','100 100 100 0 0 0 2072','100 150 150 0 0 0 0','100 100 100 0 0 0 0','100 100 100 0 0 0 0']
    result=subprocess.run([args.binary],input='\n'.join(commands)+'\n',text=True,capture_output=True,check=True)
    different=0;maximum=0;count=0
    for line in result.stdout.splitlines():
        values=line.split();index=int(values[0]);row=data['segments'][index];count+=1
        expected=dict(zip(['y0','y1','curve','gap'],map(f32,values[1:])))
        if any(row[k]!=expected[k] for k in expected):different+=1
        compiler.compare_numeric_reference(index,row,expected)
        maximum=max(maximum,max(abs(row[key]-expected[key]) for key in ['y0','y1']))
    if count!=data['totalCount']:raise SystemExit('Oracle row count mismatch')
    print(f'{count-different}/{count} bit-exact; {different} measured libm differences (4height rows+1curve row), max{maximum}; no original-game-run claim')

if __name__=='__main__':main()
