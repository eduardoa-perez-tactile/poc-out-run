#!/usr/bin/env python3
"""Compile pinned ordinary and procedural goal compatibility profiles. No runtime art/RNG/goal expansion.
Default verifies committed output; --write explicitly regenerates reviewed data.
"""
import argparse
import importlib.util
from types import SimpleNamespace
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import subprocess
import zlib

ROOT=Path(__file__).resolve().parents[2]
PIN='6882721c99bc79365f815f68d389bf5078129e68'
MAP='Resources/Maps/MapLevels/Map1/map.txt'
FIXTURE=ROOT/'scripts/content/fixtures/map01-source.json'
OUTPUT=ROOT/'outrun/assets/data/biomes/map01.json'
MAP_SPECS={
    1:{'localCount':26,'sharedCount':45,'links':{'left':2,'right':3,'sequential':2},'windowBound':256},
    2:{'localCount':36,'sharedCount':0,'links':{'left':4,'right':5,'sequential':3},'windowBound':1000},
    3:{'localCount':39,'sharedCount':0,'links':{'left':5,'right':6,'sequential':4},'windowBound':1000},
    4:{'localCount':48,'sharedCount':0,'links':{'left':7,'right':8,'sequential':5},'windowBound':1000},
    5:{'localCount':53,'sharedCount':0,'links':{'left':8,'right':9,'sequential':6},'windowBound':1000},
    6:{'localCount':51,'sharedCount':0,'links':{'left':9,'right':10,'sequential':7},'windowBound':1000},
    7:{'localCount':38,'sharedCount':0,'links':{'left':11,'right':12,'sequential':8},'windowBound':1000},
    8:{'localCount':35,'sharedCount':0,'links':{'left':12,'right':13,'sequential':9},'windowBound':1000},
    9:{'localCount':33,'sharedCount':0,'links':{'left':13,'right':14,'sequential':10},'windowBound':1000},
    10:{'localCount':51,'sharedCount':0,'links':{'left':14,'right':15,'sequential':11},'windowBound':1000},
    11:{'localCount':27,'sharedCount':0,'links':{'left':16,'right':16,'sequential':12},'windowBound':1000},
    12:{'localCount':41,'sharedCount':0,'links':{'left':16,'right':16,'sequential':13},'windowBound':1000},
    13:{'localCount':40,'sharedCount':0,'links':{'left':16,'right':16,'sequential':14},'windowBound':1000},
    14:{'localCount':41,'sharedCount':0,'links':{'left':16,'right':16,'sequential':15},'windowBound':1000},
    15:{'localCount':49,'sharedCount':0,'links':{'left':16,'right':16,'sequential':16},'windowBound':1000},
    16:{'localCount':0,'sharedCount':45,'links':{'left':-1,'right':-1,'sequential':-1},'windowBound':1000},
}
def map_spec(map_id):
    need(type(map_id)is int and map_id in MAP_SPECS,'profile',1,'unsupported map ID')
    return MAP_SPECS[map_id]
def map_path(map_id):
    map_spec(map_id);need(map_id!=16,'profile',1,'goal has no map.txt')
    return f'Resources/Maps/MapLevels/Map{map_id}/map.txt'

def goal_adapter():
    spec=importlib.util.spec_from_file_location('outrun_goal_recipe',Path(__file__).with_name('goal_recipe.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module,SimpleNamespace(PIN=PIN,need=need,f32=f32,png_size=png_size)


SLOTS=['FAR_LEFT','NEAR_LEFT','CENTER','FAR_RIGHT','NEAR_RIGHT']
COLORS=['BACKGROUND','OUTSIDE_ROAD_1','OUTSIDE_ROAD_2','ROAD_1','ROAD_2','RUMBLE_1','RUMBLE_2','LANE_1','LANE_2','RUMBLE_LANE_1','RUMBLE_LANE_2']
GAPS={3:0,4:1036,5:2072,6:3108,7:4144,8:5180,2:24756}
f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
PI=f32(math.pi)
def fail(path,line,message):raise ValueError(f'{path}:{line}:1: {message}')
def need(condition,path,line,message):
    if not condition:fail(path,line,message)
def number(token,path,line,integer=False):
    pattern=r'-?\d+' if integer else r'-?(?:\d+(?:\.\d*)?|\.\d+)'
    need(re.fullmatch(pattern,token),path,line,'invalid numeric token '+token)
    value=int(token) if integer else float(token)
    need(math.isfinite(value),path,line,'nonfinite number')
    need(abs(value)<=1000000,path,line,'number exceeds conversion bound')
    return value if integer else f32(value)
def png_size(raw,path):
    need(raw[:8]==b'\x89PNG\r\n\x1a\n',path,1,'invalid PNG signature')
    off=8;size=None;ended=False
    while off+12<=len(raw):
        length=struct.unpack('>I',raw[off:off+4])[0];end=off+8+length
        need(end+4<=len(raw),path,1,'truncated PNG')
        tag=raw[off+4:off+8];payload=raw[off+8:end]
        need(zlib.crc32(tag+payload)&0xffffffff==struct.unpack('>I',raw[end:end+4])[0],path,1,'PNG CRC mismatch')
        if tag==b'IHDR':
            need(size is None and length==13,path,1,'invalid PNG header')
            size=list(struct.unpack('>II',payload[:8]));need(all(0<v<=4096 for v in size),path,1,'PNG dimensions out of range')
        if tag==b'IEND':ended=True;need(end+4==len(raw),path,1,'trailing PNG bytes');break
        off=end+4
    need(size and ended,path,1,'incomplete PNG');return size

def source_fixture(source,map_id=1):
    descriptor=map_spec(map_id)
    def git(*args):return subprocess.check_output(['git','-C',str(source),*args],text=True).strip()
    need(git('rev-parse','HEAD')==PIN,'source',1,'wrong pinned source HEAD')
    need(not git('status','--porcelain=v1','--untracked-files=no','--','Resources','src'),'source',1,'tracked source modifications')
    if map_id==16:
        module,compat=goal_adapter();return module.source_goal_fixture(source,compat)
    path_map=map_path(map_id)
    def read(path):
        try:return (source/path).read_bytes()
        except OSError as error:fail(path,1,'missing/unreadable source file: '+str(error))
    def digest(path):return hashlib.sha256(read(path)).hexdigest()
    objects=[]
    for count,folder in [(descriptor['sharedCount'],'Resources/Maps/MapStartGoal'),(descriptor['localCount'],f'Resources/Maps/MapLevels/Map{map_id}')]:
        for local in range(1,count+1):
            path=f'{folder}/{local}.png';props=f'{folder}/{local}.txt';raw=read(path)
            objects.append({'id':len(objects)+1,'sourcePath':path,'sha256':hashlib.sha256(raw).hexdigest(),'sizePx':png_size(raw,path),
                            'propertiesPath':props,'propertiesText':read(props).decode() if (source/props).exists() else None})
    cpp=read('src/Logger/Logger.cpp').decode();start=cpp.index('void Logger::loadStartBiomeSprites');end=cpp.index('\n}\n',start)
    body=cpp[start:end];defs={}
    for m in re.finditer(r'SpriteInfo\*\s+(\w+)\s*=\s*new SpriteInfo\(&m.objects\[(\d+)\].*?m.collisions\[\d+\],\s*([^,]+),\s*(.*?),\s*(false|true)\);',body,re.S):
        name,index,x,y,side=m.groups();floating='widthScreen' in y
        defs[name]=(int(index)+1,float(x.strip().rstrip('f')),0 if floating else float(y.strip().rstrip('f')),side=='true',-1.6 if floating else 0)
    placements=[]
    for m in re.finditer(r'm.addSpriteInfo\((\d+),\s*(\w+),\s*Sprite_Position::(\w+),\s*false\);',body):
        segment,name,slot=m.groups();obj,x,y,side,width_factor=defs[name]
        placements.append({'segment':int(segment),'slot':SLOTS.index(slot),'objectId':obj,'offsetX':f32(x),'offsetY':f32(y),'side':side,
                           'viewportYFactor':f32(width_factor),'sourceLine':cpp[:start+m.start()].count('\n')+1})
    need(len(placements)==19,'src/Logger/Logger.cpp',1254,'start recipe extraction changed')
    if map_id!=1:placements=[]
    sources=['src/Logger/Logger.cpp','src/Scene/Biome/Biome.cpp','src/Scene/Map/Map.cpp','src/Game/Game.cpp','src/Globals.h']
    return {'sourceCommit':PIN,'mapPath':path_map,'mapText':read(path_map).decode(),'mapSha256':digest(path_map),
            'implementationSources':{p:digest(p) for p in sources},'objects':objects,'startPlacements':placements}

def properties(obj):
    w,h=obj['sizePx'];path=obj['propertiesPath']
    result={'sourceSizePx':[w,h],'collision':True,'scale':1,'collisionWidthSourcePx':w,'showTerrain':0,
            'pivotLeft':[1,1],'pivotRight':[0,1],'collisionPivotLeft':[.5,1],'collisionPivotRight':[.5,1]}
    names={'COLLISION:':('collision',1),'SCALE:':('scale',1),'WIDTH_COLLISION:':('collisionWidthSourcePx',1),
           'SHOW_TERRAIN:':('showTerrain',1),'PIVOT_LEFT:':('pivotLeft',2),'PIVOT_RIGHT:':('pivotRight',2),
           'PIVOT_COL_LEFT:':('collisionPivotLeft',2),'PIVOT_COL_RIGHT:':('collisionPivotRight',2)}
    for row,line in enumerate((obj['propertiesText'] or '').splitlines(),1):
        t=line.split()
        if not t:continue
        need(t[0] in names,path,row,'unknown property '+t[0]);key,n=names[t[0]];need(len(t)==n+1,path,row,'wrong property arity')
        values=[number(x,path,row) for x in t[1:]]
        if key=='collision':need(t[1] in ('0','1'),path,row,'collision must be 0/1');result[key]=bool(values[0])
        elif key=='showTerrain':need(values[0] in range(5),path,row,'terrain must be 0..4');result[key]=int(values[0])
        elif n==2:result[key]=values
        else:
            need(values[0]>0 if key=='scale' else values[0]>=0,path,row,'negative/zero property size');result[key]=values[0]
    return {'id':obj['id'],'sourcePath':obj['sourcePath'],'sha256':obj['sha256'],
            'propertiesSha256':hashlib.sha256((obj['propertiesText'] or '').encode()).hexdigest(),'hasProperties':obj['propertiesText'] is not None,**result}

def ease(a,b,t,entry=False):
    if entry:return f32(a+f32(b-a)*math.pow(t,2))
    cosine=f32(math.cos(f32(t*PI)));fraction=f32(f32(-cosine/2)+.5)
    return f32(a+f32(f32(b-a)*fraction))

def expand(segments,enter,hold,leave,curve,slope,mirror,gap,source_line,path=MAP):
    total=enter+hold+leave;need(total>0,path,source_line,'empty relief')
    need(len(segments)+total<=20000,path,source_line,'segment bound exceeded')
    need(not mirror or bool(segments),path,source_line,'first relief cannot mirror without a previous segment')
    first=segments[-1]['y1'] if segments else 0
    distance=segments[-1]['gap'] if segments else gap
    increment=math.trunc(f32(f32((24756 if mirror else gap)-distance)/f32(total)))
    end=f32(first+f32(slope*150));start=len(segments);swap=0
    for phase,length in enumerate([enter,hold,leave]):
        for n in range(length):
            distance=f32(distance+increment)
            elapsed=n if phase==0 else enter+n if phase==1 else enter+hold+n
            c=ease(0,curve,f32(n/enter),True) if phase==0 else curve if phase==1 else ease(curve,0,f32(n/leave))
            y=ease(first,end,f32(elapsed/total))
            segments.append({'y0':segments[-1]['y1'] if segments else 0,'y1':y,'curve':c,'gap':distance,'mirror':mirror,'light':(len(segments)//3)%2})
            if phase==1 and n==hold//2 and mirror:swap=len(segments)
    return start,total,swap

def validated_objects(fixture,descriptor,map_id):
    for i,obj in enumerate(fixture['objects'],1):
        expected=f'Resources/Maps/MapStartGoal/{i}.png' if i<=descriptor['sharedCount'] else f'Resources/Maps/MapLevels/Map{map_id}/{i-descriptor["sharedCount"]}.png'
        need(obj['id']==i and obj['sourcePath']==expected,'fixture',1,'object ID/path mismatch')
        need(obj['propertiesPath']==expected[:-4]+'.txt','fixture',1,'object property path mismatch')
        need(obj['propertiesText'] is None or isinstance(obj['propertiesText'],str),'fixture',1,'invalid optional property text')
        need(re.fullmatch('[0-9a-f]{64}',obj['sha256']) and len(obj['sizePx'])==2 and all(type(v)is int and 0<v<=4096 for v in obj['sizePx']),'fixture',1,'invalid PNG metadata')
    objects=[properties(o) for o in fixture['objects']]
    return objects

def write_placement(winners,overwritten,segment,slot,definition):
    key=(segment,slot)
    if key in winners:overwritten.append({'segment':segment,'slot':slot,'previousDefinition':winners[key],'definition':definition})
    winners[key]=definition

def compile_map(fixture,gradient,map_id=1):
    descriptor=map_spec(map_id)
    if map_id==16:return compile_goal(fixture,gradient)
    object_count=descriptor['sharedCount']+descriptor['localCount']
    need(fixture['sourceCommit']==PIN,'fixture',1,'wrong source commit')
    path=fixture['mapPath'];text=fixture['mapText']
    need(path==map_path(map_id) and hashlib.sha256(text.encode()).hexdigest()==fixture['mapSha256'],'fixture',1,'map source hash/path mismatch')
    need(gradient in (-1,0,1),'profile',1,'fork gradient must be -1,0,1')
    need(len(fixture['objects'])==object_count,'fixture',1,'expected45shared+26localobjects' if map_id==1 else f'expected{object_count}localobjects')
    if map_id!=1:
        need(fixture['startPlacements']==[],'fixture',1,'local maps cannot contain start placements')
        sources=fixture['implementationSources']
        expected={'src/Logger/Logger.cpp','src/Scene/Biome/Biome.cpp','src/Scene/Map/Map.cpp','src/Game/Game.cpp','src/Globals.h'}
        need(set(sources)==expected and all(isinstance(v,str) and re.fullmatch('[0-9a-f]{64}',v) for v in sources.values()),'fixture',1,'invalid implementation source hashes')
    objects=validated_objects(fixture,descriptor,map_id)
    segments=[];commands=[];definitions=[];winners={};overwritten=[];candidate=0;header={};palette={};section='global';group=None;group_slots=set();checkpoint=-1;swap=0;marker_index=-1
    def place(segment,slot,definition):
        nonlocal candidate
        candidate+=1;write_placement(winners,overwritten,segment,slot,definition)
    for start in fixture['startPlacements']:
        definition=len(definitions);definitions.append({'id':definition,'kind':'start','sourceLine':start['sourceLine'],**{k:start[k] for k in ['objectId','offsetX','offsetY','side','viewportYFactor']}})
        place(start['segment'],start['slot'],definition)
    for row,line in enumerate(text.splitlines(),1):
        t=line.split()
        if not t:continue
        key=t[0]
        markers=['GLOBAL_CONF','COLORS','START_RELIEF','SPRITES','END_FILE']
        if key in markers:
            need(markers.index(key)==marker_index+1,path,row,'unexpected/missing/duplicate section')
            marker_index+=1
            need(len(t)==1,path,row,'section has arguments')
            if key in ['SPRITES','END_FILE']:need(bool(segments),path,row,'empty relief')
            if key=='END_FILE':need(group is not None and bool(group_slots),path,row,'empty sprite group')
            if key=='START_RELIEF':section='relief'
            elif key=='SPRITES':section='sprites'
            elif key=='END_FILE':section='end'
            continue
        if section=='global':
            if key.startswith('COLOR_'):
                name=key[6:].rstrip(':');need(marker_index==1 and len(palette)<11 and name==COLORS[len(palette)] and key=='COLOR_'+name+':' and len(t)==5,path,row,'invalid/duplicate color')
                rgba=[number(x,path,row,True) for x in t[1:]];need(all(0<=x<=255 for x in rgba),path,row,'RGBA must be0..255');palette[name]=rgba
            else:
                need(marker_index==0 and len(header)<3 and key==['TIME:','TERRAIN:','ROAD_TERRAIN:'][len(header)] and len(t)==2,path,row,'invalid global record')
                header[key]=number(t[1],path,row,True)
            continue
        if section=='relief':
            name=key.rstrip(':');arity={'STRAIGHT':5,'CURVE_LEFT':7,'CURVE_RIGHT':7,'HILL_STRAIGHT':6,'HILL_LEFT':7,'HILL_RIGHT':7}
            need(key==name+':' and name in arity and len(t)==arity.get(name,0)+1,path,row,'unknown relief or wrong arity')
            args=[number(x,path,row,i not in ([3] if name.startswith('CURVE_') else [4] if name in ['HILL_LEFT','HILL_RIGHT'] else [])) for i,x in enumerate(t[1:])]
            e,h,l=args[:3];need(all(v>=0 for v in [e,h,l]),path,row,'negative phase length')
            curve=slope=0;mirror=False
            if name=='STRAIGHT':mirror,tracks=args[3:];need(mirror in (0,1),path,row,'mirror must be0/1')
            elif name.startswith('CURVE_'):
                curve,mirror,tracks,factor=args[3:];need(factor>0,path,row,'hold factor must be positive');h*=factor
            elif name=='HILL_STRAIGHT':slope,tracks,factor=args[3:];need(factor>0,path,row,'hold factor must be positive');h*=factor
            else:slope,curve,mirror,tracks=args[3:];l=e # Source compatibility bug: authored leave ignored.
            need(mirror in (0,1) and tracks in GAPS,path,row,'invalid mirror/tracks')
            if 'LEFT' in name:need(curve<0,path,row,'left curve must be negative')
            if 'RIGHT' in name:need(curve>0,path,row,'right curve must be positive')
            first,count,choice=expand(segments,e,h,l,curve,slope,bool(mirror),GAPS[tracks],row,path)
            if not swap:swap=choice
            commands.append({'sourceLine':row,'command':name,'arguments':args,'firstSegment':first,'count':count,'effective':[e,h,l]})
            continue
        need(section=='sprites',path,row,'record after END_FILE')
        if key in ['GROUP_LINES:','LINE:','LINE_CHECKPOINT:']:
            need(group is None or bool(group_slots),path,row,'previous group has no sprites');group_slots=set()
        if key=='GROUP_LINES:':
            need(len(t)==5,path,row,'GROUP_LINES needs4arguments');a,b,inc,freq=[number(x,path,row,True) for x in t[1:]]
            need(0<=a<b<len(segments) and inc>0 and freq>0,path,row,'invalid group bounds/increment/frequency');group=(a,b,inc,freq)
        elif key in ['LINE:','LINE_CHECKPOINT:']:
            need(len(t)==2,path,row,'LINE needs1argument');a=number(t[1],path,row,True)
            need(0<=a<len(segments),path,row,'line out of range');group=(a,a+1,1,1)
            if key=='LINE_CHECKPOINT:':checkpoint=a
        else:
            need(key in ['SPRITE_'+s+':' for s in SLOTS] and group is not None and len(t)==5,path,row,'invalid sprite/context/arity')
            obj=number(t[1],path,row,True);x,y=[number(v,path,row) for v in t[2:4]];side=number(t[4],path,row,True)
            need(1<=obj<=object_count and side in (0,1),path,row,'object reference/side out of range')
            d=len(definitions);definitions.append({'id':d,'kind':'authored','sourceLine':row,'objectId':obj,'offsetX':x,'offsetY':y,'side':bool(side),'viewportYFactor':0})
            slot=SLOTS.index(key[7:].rstrip(':'));need(not group_slots or slot>max(group_slots),path,row,'duplicate/out-of-order sprite slot');group_slots.add(slot);a,b,inc,freq=group
            for segment in range(a,b,inc):
                if segment%freq==0:place(segment,slot,d)
    need(section=='end' and len(palette)==11 and set(header)=={'TIME:','TERRAIN:','ROAD_TERRAIN:'},path,1,'missing required sections/globals/colors/end')
    need(header['TIME:']>0 and header['TERRAIN:'] in range(1,5) and header['ROAD_TERRAIN:'] in range(5),path,1,'time/terrain out of range')
    return finish_map(fixture,map_id,gradient,descriptor,objects,segments,commands,definitions,winners,overwritten,candidate,checkpoint,swap,header,palette,{**fixture['implementationSources'],path:fixture['mapSha256']},path)

def finish_map(fixture,map_id,gradient,descriptor,objects,segments,commands,definitions,winners,overwritten,candidate,checkpoint,swap,header,palette,source_hashes,path):
    authored=len(segments)
    for e,h,l,c,s,m,g in [(10,300,50,-2,gradient*80,True,0),(100,100,100,0,0,True,24756),(100,100,100,0,0,False,2072),(100,150,150,0,0,False,0),(100,100,100,0,0,False,0),(100,100,100,0,0,False,0)]:
        _,_,choice=expand(segments,e,h,l,c,s,m,g,0,path)
        if not swap:swap=choice
    placements=[{'id':segment*5+slot,'segment':segment,'slot':slot,'definition':d} for (segment,slot),d in sorted(winners.items())]
    offsets=[];cursor=0
    for segment in range(len(segments)+1):
        while cursor<len(placements) and placements[cursor]['segment']<segment:cursor+=1
        offsets.append(cursor)
    maximum=max(offsets[min(len(segments),i+200)]-offsets[i] for i in range(len(segments)))
    # Five canonical slots per row x 200 rows bounds DATA, not renderer capacity.
    need(maximum<=descriptor['windowBound'],path,1,'visible diagnostic pool bound exceeded')
    data={'$type':'SourceBiome','id':map_id,'sourceCommit':PIN,'inputSha256':hashlib.sha256(json.dumps(fixture,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
          'sourceHashes':source_hashes,'profile':'sourceCompatibility-original','forkGradient':gradient,
          'segmentLength':150,'playerOffsetZ':702,'cameraHeight':800,'referenceWidth':921,'authoredCount':authored,'totalCount':len(segments),
          'swapLine':swap,'lastLine':len(segments)-200,'checkpointLine':checkpoint,'timeSeconds':header['TIME:'],'terrain':header['TERRAIN:'],'roadTerrain':header['ROAD_TERRAIN:'],
          'links':dict(descriptor['links']),'palette':[palette[k] for k in COLORS],'commands':commands,'objects':objects,'definitions':definitions,
          'placements':placements,'overwritten':overwritten,'candidatePlacements':candidate,'maxWindowProps':maximum,'objectOffsets':offsets,'segments':segments}
    return data

def compile_goal(fixture,gradient):
    module,compat=goal_adapter();recipe=module.goal_recipe(fixture,compat)
    need(set(recipe)=={'definitions','writes'},'goal-recipe',1,'invalid procedural adapter fields')
    path=fixture['sourceRecipe']['biome']['path'];base=fixture['sourceRecipe']['biome'];text=base['text']
    need(gradient==0,path,base['firstLine'],'goal review profile requires gradient0')
    descriptor=map_spec(16);objects=validated_objects(fixture,descriptor,16)
    need(len(objects)==45,path,base['firstLine'],'goal requires45sharedobjects')
    times=re.findall(r'\btime\s*=\s*(\d+)\s*;',text)
    need(times==['80'],path,base['firstLine'],'goal source time changed')
    names=['skyBiome','sandBiome1','sandBiome2','roadBiome1','roadBiome2','rumbleBiome1','rumbleBiome2','laneBiome1','laneBiome2','rumbleLane1','rumbleLane2']
    colors=re.findall(r'\b(\w+)\s*=\s*sf::Color\(([^)]+)\)\s*;',text)
    need([name for name,_ in colors]==names,path,base['firstLine'],'goal source palette changed')
    palette={}
    for key,(_,tokens) in zip(COLORS,colors):
        rgba=[number(t.strip(),path,base['firstLine'],True) for t in tokens.split(',')]
        need(len(rgba)==3 and all(0<=v<=255 for v in rgba),path,base['firstLine'],'invalid goal RGB')
        palette[key]=rgba+[255]
    calls=list(re.finditer(r'\baddBiome\(([^;]+)\)\s*;',text))
    need(len(calls)==1,path,base['firstLine'],'goal base geometry call changed')
    tokens=[t.strip() for t in calls[0][1].split(',')]
    need(tokens==['350','350','350','0','0','false','false','threeTracksDistance','not_count_lines'],path,base['firstLine'],'goal base geometry operands changed')
    line=base['firstLine']+text[:calls[0].start()].count('\n')
    segments=[];first,count,swap=expand(segments,350,350,350,0,0,False,0,line,path)
    commands=[{'sourceLine':line,'command':'STRAIGHT','arguments':[350,350,350,0,3],'firstSegment':first,'count':count,'effective':[350,350,350]}]
    definitions=recipe['definitions'];winners={};overwritten=[]
    for i,d in enumerate(definitions):
        need(d['id']==i and d['kind']=='goal' and type(d['sourceLine'])is int and d['sourceLine']>0,path,line,'invalid goal definition identity')
        need(type(d['objectId'])is int and 1<=d['objectId']<=45,path,line,'invalid goal object ID')
        need(all(type(d[k])in (int,float) and math.isfinite(d[k]) and d[k]==f32(d[k]) for k in ['offsetX','offsetY','viewportYFactor']),path,line,'invalid goal offsets')
        need(type(d['side'])is bool,path,line,'invalid goal side')
    for write in recipe['writes']:
        need(set(write)=={'segment','slot','definition'},path,line,'invalid goal write fields')
        z,slot,d=write['segment'],write['slot'],write['definition']
        need(all(type(v)is int for v in [z,slot,d]) and 0<=z<1050 and 0<=slot<5 and 0<=d<len(definitions),path,line,'goal write range exceeded')
        write_placement(winners,overwritten,z,slot,d)
    # Explicit goal-terrain-defaults-v1 adaptation; source leaves these ints uninitialized.
    header={'TIME:':int(times[0]),'TERRAIN:':fixture['goalPolicy']['terrain'],'ROAD_TERRAIN:':fixture['goalPolicy']['roadTerrain']}
    return finish_map(fixture,16,gradient,descriptor,objects,segments,commands,definitions,winners,overwritten,len(recipe['writes']),-1,swap,header,palette,dict(fixture['implementationSources']),path)

# Source-oracle comparison only: platform cosf vs Python double cos rounded to
# f32 differs in exactly these measured source-profile fields. Never use this
# tolerance in runtime state, committed-data equality or replay verification.
def compare_numeric_reference(index,actual,expected):
    need(actual['gap']==expected['gap'],'numeric-oracle',index,'exact gap mismatch')
    if index==884:
        bits=lambda value:struct.unpack('<I',struct.pack('<f',value))[0]
        need(abs(bits(actual['curve'])-bits(expected['curve']))<=1,'numeric-oracle',index,'curve exceeds measured1f32ULP exception')
    else:need(actual['curve']==expected['curve'],'numeric-oracle',index,'exact curve mismatch')
    exceptions={(437,'y1'),(438,'y0'),(456,'y1'),(457,'y0')}
    for key in ['y0','y1']:
        if (index,key) in exceptions:need(abs(actual[key]-expected[key])<=.001,'numeric-oracle',index,'height exceeds measured0.001 exception')
        else:need(actual[key]==expected[key],'numeric-oracle',index,'exact height mismatch')

def encoded(data):return json.dumps(data,separators=(',',':'),allow_nan=False)+'\n'
def main():
    parser=argparse.ArgumentParser(description=__doc__);group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--source',type=Path);group.add_argument('--fixture',type=Path)
    parser.add_argument('--map',type=int,choices=range(1,17),default=1)
    parser.add_argument('--fork-gradient',type=int,choices=[-1,0,1],required=True);parser.add_argument('--write',action='store_true');args=parser.parse_args()
    fixture=source_fixture(args.source,args.map) if args.source else json.loads(args.fixture.read_text());data=compile_map(fixture,args.fork_gradient,args.map)
    stem='goal' if args.map==16 else f'map{args.map:02}'
    output=ROOT/f'outrun/assets/data/biomes/{stem}.json';fixture_path=ROOT/f'scripts/content/fixtures/{stem}-source.json'
    if args.write:
        output.parent.mkdir(parents=True,exist_ok=True);output.write_text(encoded(data))
        if args.source:fixture_path.write_text(json.dumps(fixture,indent=2)+'\n')
    else:need(output.exists() and output.read_text()==encoded(data),'output',1,'committed output differs; review then use --write')
    print(f"Map{args.map} {data['authoredCount']}/{data['totalCount']} segments, swap{data['swapLine']}, {len(data['placements'])} placements, max{data['maxWindowProps']}/{map_spec(args.map)['windowBound']}; {len(encoded(data))} data bytes")
if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError,subprocess.CalledProcessError) as error:raise SystemExit(str(error))
