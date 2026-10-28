"""Rebuild analytical reference boards from a local pinned OutRun checkout (Pillow required)."""
import argparse
import json
import re
import subprocess
from collections import Counter
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

PIN = '6882721c99bc79365f815f68d389bf5078129e68'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--source', type=Path, required=True)
p.add_argument('--out', type=Path, default=Path(__file__).parent / 'references')
a = p.parse_args()
revision = subprocess.check_output(['git', '-C', str(a.source), 'rev-parse', 'HEAD'], text=True).strip()
if revision != PIN:
    raise SystemExit(f'Expected source {PIN}; found {revision}')
r = a.source / 'Resources'
a.out.mkdir(parents=True, exist_ok=True)
font = ImageFont.load_default(size=16)
small = ImageFont.load_default(size=12)
manifest = {'sourceCommit': PIN, 'purpose': 'Documentation reference boards, not runtime atlases or approved new art', 'boards': {}, 'palettes': {}, 'specimens': {}}

def open_ref(path, frame=None):
    im = Image.open(r / path)
    if frame is not None:
        im.seek(frame)
    im = im.convert('RGBA')
    key = str(path) + (f'#frame={frame}' if frame is not None else '')
    manifest['specimens'][key] = {'path': str(path), 'frame': frame, 'width': im.width, 'height': im.height}
    return im

def board(name, title, entries, cols, cell):
    cw, ch = cell
    out = Image.new('RGB', (cols*cw, 70+((len(entries)+cols-1)//cols)*ch), '#172334')
    d = ImageDraw.Draw(out)
    d.text((18, 12), title, fill='#ffffff', font=font)
    d.text((18, 39), 'Observed source reference | thumbnails use nearest sampling | original paths in source-index.json', fill='#b7cbde', font=small)
    keys = []
    for i,(label,im,key) in enumerate(entries):
        x,y=(i%cols)*cw,70+(i//cols)*ch
        for yy in range(y+5,y+ch-40,16):
            for xx in range(x+5,x+cw-5,16):
                d.rectangle((xx,yy,min(xx+15,x+cw-6),min(yy+15,y+ch-41)),fill='#3b4655' if ((xx-x)//16+(yy-y)//16)%2 else '#303a49')
        # Uniform fit, no cropping; scaled references never define production dimensions.
        scale=min((cw-18)/im.width,(ch-55)/im.height)
        scaled=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST)
        out.paste(scaled,(x+(cw-scaled.width)//2,y+8+(ch-55-scaled.height)//2),scaled)
        d.text((x+9,y+ch-37),label,fill='#ffffff',font=small)
        d.text((x+9,y+ch-21),f'{im.width} x {im.height} source px',fill='#b7cbde',font=small)
        keys.append(key)
    out.save(a.out/f'{name}.png',optimize=True)
    manifest['boards'][name]={'file':f'{name}.png','specimens':keys}

entries=[]
for name,frame in [('Salida.gif',38),('Fork.gif',15),('Fork.gif',64),('GreenCar.gif',36),('DarkBlueCar.gif',40),('OrangeCar.gif',35)]:
    path=f'Gifs/{name}';im=open_ref(path,frame)
    entries.append((f'{name} frame {frame}',im,f'{path}#frame={frame}'))
board('gameplay','Gameplay composition, route split and palette references',entries,3,(400,340))
entries=[]
for mid in range(1,16):
    path=f'Maps/MapLevels/Map{mid}/back.png';im=open_ref(path)
    frontpath=f'Maps/MapLevels/Map{mid}/front.png';front=open_ref(frontpath)
    canvas=Image.new('RGBA',(max(im.width,front.width),max(im.height,front.height)),(0,148,255,255))
    canvas.alpha_composite(im,(0,canvas.height-im.height));canvas.alpha_composite(front,(0,canvas.height-front.height))
    entries.append((f'Map{mid}: back + front, bottom-aligned',canvas,path+' + '+frontpath))
    text=(r/f'Maps/MapLevels/Map{mid}/map.txt').read_text()
    manifest['palettes'][f'Map{mid}']={m[0]:{'rgba':list(map(int,m[1:])), 'hex':'#'+''.join(f'{int(v):02X}' for v in m[1:4])} for m in re.findall(r'^(COLOR_\w+):\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)',text,re.M)}
board('biomes','All 15 biome background pairs | specimen alignment, not in-game composition',entries,3,(400,180))
entries=[]
for mid,ids in [(1,[1,7,14,20]),(5,[1,12,28,48]),(10,[1,12,25,40]),(15,[1,12,25,40])]:
    for n in ids:
        path=f'Maps/MapLevels/Map{mid}/{n}.png'
        if not (r/path).exists():continue
        im=open_ref(path);entries.append((f'Map{mid}/{n}.png',im,path))
board('props','Roadside silhouettes and shading | selected specimens, not a complete catalog',entries,4,(300,220))
entries=[]
for n in [1,5,9,13,17,21,25,41,61,81,101,121,141,148]:
    path=f'Vehicles/PlayerCar/Ferraris/Ferrari1/c{n}.png'; im=open_ref(path);entries.append((f'Ferrari1/c{n}.png',im,path))
for car,n in [(1,1),(1,9),(6,1),(12,1),(20,1),(32,1)]:
    path=f'Vehicles/TrafficCars/Car{car}/c{n}.png';im=open_ref(path);entries.append((f'Traffic Car{car}/c{n}.png',im,path))
board('vehicles','Vehicle pose, silhouette and native-pixel references',entries,4,(300,180))
entries=[]
for n in [1,4,5,10,11,16,17,22,23,28]:
    path=f'Vehicles/PlayerCar/Wheels/c{n}.png';im=open_ref(path);entries.append((f'Wheels/c{n}.png',im,path))
board('effects','Separate wheel-effect source sprites | alpha shown on checkerboard',entries,5,(240,170))
entries=[]
for path in ['Menus/MainMenu/LogoMain1.png','Menus/CarSelectionMenu/Garage.png','Menus/MusicMenu/radioBackground.png','Huds/HudRound/Time_Indicator.png','Huds/HudRound/Score_Indicator.png','Huds/HudRound/Speed_Indicator.png','Huds/HudRound/Gear_Indicator.png','Huds/HudRound/Tree_level_15_indicator.png']:
    im=open_ref(path);entries.append((path.split('/')[-1],im,path))
board('ui','Observed menu and HUD artwork | adapt layout for landscape/mobile',entries,4,(300,240))
# Exact palette swatches are sampled from map configuration, not from compressed screenshots.
out=Image.new('RGB',(1200,70+15*60),'#172334');d=ImageDraw.Draw(out)
d.text((18,14),'Configured biome palettes | sky / terrain pair / road pair / rumble pair / lane pair',fill='white',font=font)
keys=['COLOR_BACKGROUND','COLOR_OUTSIDE_ROAD_1','COLOR_OUTSIDE_ROAD_2','COLOR_ROAD_1','COLOR_ROAD_2','COLOR_RUMBLE_1','COLOR_RUMBLE_2','COLOR_LANE_1','COLOR_LANE_2']
for row,(mid,palette) in enumerate(manifest['palettes'].items()):
    y=70+row*60;d.text((12,y+15),mid,fill='white',font=font)
    for col,key in enumerate(keys):
        v=palette[key];x=105+col*120
        d.rectangle((x,y,x+110,y+27),fill=tuple(v['rgba'][:3]));d.text((x,y+31),v['hex'],font=small,fill='white')
out.save(a.out/'palettes.png',optimize=True)
manifest['boards']['palettes']={'file':'palettes.png','source':'map.txt COLOR_* values; full RGBA in palettes'}
(a.out/'source-index.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'boards':len(manifest['boards']),'specimens':len(manifest['specimens']),'sourceCommit':revision}))
