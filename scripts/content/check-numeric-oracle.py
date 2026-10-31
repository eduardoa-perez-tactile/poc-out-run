"""Optional extracted C++ arithmetic comparison; normal CI consumes recorded samples.
clang++ -std=c++17 -O0 -ffp-contract=off scripts/content/numeric-oracle.cpp -o /tmp/map01-numeric-oracle
python3 scripts/content/check-numeric-oracle.py --binary /tmp/map01-numeric-oracle
Add --map 2 or --map 3 for full-row checks against the separately captured map-specific pairs.
"""
import argparse
import hashlib
import importlib.util
import json
import struct
import subprocess
from pathlib import Path
P=Path(__file__).parent
ROOT=P.resolve().parents[1]
spec=importlib.util.spec_from_file_location('compiler',P/'convert-map.py');compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
f32=lambda x:struct.unpack('<f',struct.pack('<f',float(x)))[0]
FIELDS=('y0','y1','curve','gap')

def independent_commands(fixture):
    """Parse SOURCE operands, not compiler geometry/commands, for the C++ diagnostic."""
    commands=[];section=False
    for line in fixture['mapText'].splitlines():
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
    # Source ORIGINAL append, Map.cpp498-526, gradient0 only in this capture.
    commands+=['10 300 50 -2 0 1 0','100 100 100 0 0 1 24756','100 100 100 0 0 0 2072','100 150 150 0 0 0 0','100 100 100 0 0 0 0','100 100 100 0 0 0 0']
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

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--binary',required=True)
    parser.add_argument('--map',type=int,choices=[1,2,3],default=1);args=parser.parse_args()
    if args.map!=1:
        fixture=json.loads((P/f'fixtures/map{args.map:02}-source.json').read_text())
        captured=json.loads((P/'fixtures/maps23-numeric.json').read_text());reference=captured['maps'][str(args.map)]
        commands=independent_commands(fixture)
        if captured['sourceCommit']!=compiler.PIN or captured['kernelSha256']!=hashlib.sha256((ROOT/captured['kernel']).read_bytes()).hexdigest():raise ValueError('numeric capture source/kernel mismatch')
        if hashlib.sha256(fixture['mapText'].encode()).hexdigest()!=reference['sourceMapSha256'] or hashlib.sha256(commands.encode()).hexdigest()!=reference['commandStreamSha256']:raise ValueError('numeric capture source command mismatch')
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
