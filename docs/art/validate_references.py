"""Validate guide links/reference metadata without an engine; optionally compare local source."""
import argparse
import json
import re
import struct
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--source', type=Path)
a = p.parse_args()
root = Path(__file__).resolve().parent
index = json.loads((root/'references/source-index.json').read_text())
assert index['sourceCommit'] == '6882721c99bc79365f815f68d389bf5078129e68'
assert len(index['boards']) == 7 and len(index['palettes']) == 15

def slug(text):
    return re.sub(r'[^\w\- ]', '', text.lower()).replace(' ', '-')

link_count = 0
for doc in root.glob('*.md'):
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', doc.read_text()):
        if target.startswith(('https://','http://')):
            continue
        path, _, anchor = unquote(target).partition('#')
        dest = (doc.parent/path).resolve() if path else doc
        assert dest.exists(), f'{doc.name}: missing {target}'
        if anchor and dest.suffix == '.md':
            headings = {slug(x) for x in re.findall(r'^#+ (.+)$', dest.read_text(), re.M)}
            assert anchor in headings, f'{doc.name}: missing heading {target}'
        link_count += 1
for board in index['boards'].values():
    path=root/'references'/board['file']
    data=path.read_bytes()
    assert data[:8]==b'\x89PNG\r\n\x1a\n',path
    w,h=struct.unpack('>II',data[16:24])
    assert w>0 and h>0
ET.parse(root/'references/landscape-layout.svg')
keys=['COLOR_BACKGROUND','COLOR_OUTSIDE_ROAD_1','COLOR_OUTSIDE_ROAD_2','COLOR_ROAD_1','COLOR_ROAD_2']
rows=0
for line in (root/'environments.md').read_text().splitlines():
    if re.match(r'\| \d+ \|',line):
        mid=int(line.split('|')[1]);found=re.findall(r'#[0-9A-F]{6}',line)
        assert found==[index['palettes'][f'Map{mid}'][k]['hex'] for k in keys],f'Map{mid} table differs'
        rows+=1
assert rows==15
if a.source:
    revision=subprocess.check_output(['git','-C',str(a.source),'rev-parse','HEAD'],text=True).strip()
    assert revision==index['sourceCommit'],revision
    resources=a.source/'Resources'
    for specimen in index['specimens'].values():
        path=resources/specimen['path']; data=path.read_bytes()
        if data[:8]==b'\x89PNG\r\n\x1a\n':w,h=struct.unpack('>II',data[16:24])
        elif data[:6] in (b'GIF87a',b'GIF89a'):w,h=struct.unpack('<HH',data[6:10])
        else:raise AssertionError(f'Unexpected source encoding {path}')
        assert (w,h)==(specimen['width'],specimen['height']),path
    for mid,palette in index['palettes'].items():
        text=(resources/f'Maps/MapLevels/{mid}/map.txt').read_text()
        actual={m[0]:list(map(int,m[1:])) for m in re.findall(r'^(COLOR_\w+):\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)',text,re.M)}
        assert {k:v['rgba'] for k,v in palette.items()}==actual,mid
for script in root.glob('*.py'):
    compile(script.read_text(),str(script),'exec')
print(json.dumps({'guides':len(list(root.glob('*.md'))),'localLinks':link_count,'boards':7,'paletteRows':rows,'specimens':len(index['specimens']),'sourceCompared':bool(a.source),'ok':True}))
