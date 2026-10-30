"""Optional extracted C++ arithmetic comparison; normal CI consumes recorded samples.
clang++ -std=c++17 -O0 -ffp-contract=off scripts/content/numeric-oracle.cpp -o /tmp/map01-numeric-oracle
python3 scripts/content/check-numeric-oracle.py --binary /tmp/map01-numeric-oracle
"""
import argparse
import importlib.util
import json
import struct
import subprocess
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--binary',required=True);args=parser.parse_args()
spec=importlib.util.spec_from_file_location('compiler',Path(__file__).with_name('convert-map.py'));compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
data=json.loads((Path(__file__).resolve().parents[2]/'outrun/assets/data/biomes/map01.json').read_text())
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
f32=lambda x:struct.unpack('<f',struct.pack('<f',float(x)))[0];different=0;maximum=0;count=0
for line in result.stdout.splitlines():
    values=line.split();index=int(values[0]);row=data['segments'][index];count+=1
    expected=dict(zip(['y0','y1','curve','gap'],map(f32,values[1:])))
    if any(row[k]!=expected[k] for k in expected):different+=1
    compiler.compare_numeric_reference(index,row,expected)
    maximum=max(maximum,max(abs(row[key]-expected[key]) for key in ['y0','y1']))
if count!=data['totalCount']:raise SystemExit('Oracle row count mismatch')
print(f'{count-different}/{count} bit-exact; {different} measured libm differences (4height rows+1curve row), max{maximum}; no original-game-run claim')
