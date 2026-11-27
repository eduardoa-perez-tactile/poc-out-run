"""Pinned source goal recipe only: no geometry, properties, winner fold or assets.

The portable offline offset profile is an explicit adaptation of the original
nondeterministic/nonportable distribution, never gameplay RNG.
"""
import hashlib
import json
import re
import struct
from pathlib import Path

IMPLEMENTATION={
 'src/Logger/Logger.cpp':'837cc95c657c45ddf58749e3465b0f9eecd101989a506276f6de377a9daa4776',
 'src/Scene/Biome/Biome.cpp':'4d2fc30642ccf24d7e303dc479266d4f96e3ec4dcd3fbea71ebfdf3372ec7c8e',
 'src/Scene/Biome/Biome.h':'31e6b9e5f8f0c89ff8553012f8444746e085200f4f38e390f4474f235dadfc60',
 'src/Scene/Map/Map.cpp':'8de4c5730fd14fe625b982dda582e8a0d761efa0a3fa12dab3318dd5dd724f26',
 'src/Game/Game.cpp':'7d9a96e6f68e5349d8566e984aa412c629ed78bc4d8c505d6fcf19655e2b0026',
 'src/Globals.h':'199bc1899579ca793850d2a49065e9e499d1f8e7b32f32ceacf25678586a8ccd',
 'src/Random/Random.cpp':'bb4a491dd786fa0b0a935fb6b61b9b784d7ec0ec32cc435f3b7501c5f83d1b07',
}
EXCERPTS={
 'logger':('src/Logger/Logger.cpp',1410,'void Logger::loadGoalBiomeSprites','749399930f43b3bda093e040450fb27caf987a756d07e90f547638bee841cb3a'),
 'biome':('src/Scene/Biome/Biome.cpp',223,'void Biome::setGoalBiome','58231e8cb94128f36eb4e05906cfd469c19fbae3dbebb07594bf199f641a5313'),
}
# Full shared raw-object record and panorama provenance fingerprints, not runtime
# image dependencies. These are captured independently from the pinned sources.
OBJECTS_SHA='96a05973f9130f8d63804e0deab02a7aa60a0d5615acb67dd2b551c868895714'
PANORAMAS={'front': {'sourcePath': 'Resources/Maps/MapStartGoal/front.png', 'sha256': '51ee135683bd40c39eb5fd48cb8b8557d50fc637e4be54f3f258f6fbc3b273fc', 'sizePx': [2048, 256]}, 'back': {'sourcePath': 'Resources/Maps/MapStartGoal/back.png', 'sha256': '6ee619103994d653ec58ba777927afb3002ce1b92426732a4aeaf9cdc0161b3d', 'sizePx': [2182, 256]}}
SLOTS={'FAR_LEFT':0,'NEAR_LEFT':1,'CENTER':2,'FAR_RIGHT':3,'NEAR_RIGHT':4}

def _sha(raw):return hashlib.sha256(raw).hexdigest()
def _canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def _fingerprint(value):
 try:return _sha(_canonical(value))
 except (TypeError,ValueError):return None
def _same(left,right):
 try:return _canonical(left)==_canonical(right)
 except (TypeError,ValueError):return False
def _bits(value):return struct.unpack('<I',struct.pack('<f',value))[0]

def _policy():
 return {'id':16,'checkpointLine':-1,'terrain':1,'roadTerrain':0,
         'terrainProfile':'goal-terrain-defaults-v1',
         'randomProfile':'goal-offsets-sha256-u24-v1','seed':0,'panoramas':{k:{**v,'sizePx':list(v['sizePx'])} for k,v in PANORAMAS.items()}}

def source_goal_fixture(source,compat):
 """Read exact pinned recipe/resource bytes; caller owns checkout HEAD/clean guard."""
 source=Path(source)
 def read(path):
  try:return (source/path).read_bytes()
  except OSError as error:compat.need(False,path,1,'missing/unreadable goal source: '+str(error))
 for path,digest in IMPLEMENTATION.items():
  compat.need(_sha(read(path))==digest,path,1,'pinned goal implementation hash mismatch')
 recipe={}
 for name,(path,line,signature,digest) in EXCERPTS.items():
  text=read(path).decode();start=text.index(signature);end=text.index('\n}',start)+3
  recipe[name]={'path':path,'firstLine':text[:start].count('\n')+1,'text':text[start:end],'sha256':_sha(text[start:end].encode())}
 objects=[]
 for local in range(1,46):
  path=f'Resources/Maps/MapStartGoal/{local}.png';props=path[:-4]+'.txt';raw=read(path)
  objects.append({'id':local,'sourcePath':path,'sha256':_sha(raw),'sizePx':compat.png_size(raw,path),
                  'propertiesPath':props,'propertiesText':read(props).decode() if (source/props).exists() else None})
 for record in PANORAMAS.values():
  raw=read(record['sourcePath'])
  compat.need(_sha(raw)==record['sha256'] and compat.png_size(raw,record['sourcePath'])==record['sizePx'],record['sourcePath'],1,'goal panorama provenance mismatch')
 fixture={'sourceCommit':compat.PIN,'implementationSources':dict(IMPLEMENTATION),'objects':objects,
          'sourceRecipe':recipe,'goalPolicy':_policy(),'randomCalls':[]}
 _validate(fixture,compat)
 fixture['randomCalls']=_expand(fixture,compat)[2]
 return fixture

def _validate(fixture,compat):
 need=compat.need
 need(set(fixture)=={'sourceCommit','implementationSources','objects','sourceRecipe','goalPolicy','randomCalls'},'goal-source.json',1,'invalid goal fixture fields')
 need(fixture['sourceCommit']==compat.PIN,'goal-source.json',1,'wrong goal source commit')
 need(fixture['implementationSources']==IMPLEMENTATION,'goal-source.json',1,'pinned goal implementation hashes differ')
 need(set(fixture['sourceRecipe'])==set(EXCERPTS),'goal-source.json',1,'invalid goal recipe sections')
 for name,(path,line,signature,digest) in EXCERPTS.items():
  record=fixture['sourceRecipe'][name]
  need(set(record)=={'path','firstLine','text','sha256'} and record['path']==path and record['firstLine']==line,path,line,'goal recipe provenance mismatch')
  need(record['sha256']==digest and _sha(record['text'].encode())==digest,path,line,'unsupported/mutated goal source recipe')
 need(_fingerprint(fixture['objects'])==OBJECTS_SHA,'Resources/Maps/MapStartGoal',1,'goal shared object provenance/default records differ')
 need(_same(fixture['goalPolicy'],_policy()),'goal-source.json',1,'unsupported goal terrain/random/panorama policy')

def _expand(fixture,compat):
 """Execute the reviewed fixed source control flow from parsed constructors/calls."""
 text=fixture['sourceRecipe']['logger']['text'];first=1410;need=compat.need;q=compat.f32
 # Only the pinned excerpt is accepted by _validate. Parsing preserves actual
 # constructor source lines, expressions, object IDs and addSpriteInfo order.
 pattern=r'SpriteInfo\*\s+(\w+)\s*=\s*new SpriteInfo\(&m.objects\[(\d+)\].*?m.collisions\[\d+\],\s*(random_float\([^)]*\)|-?[\w.]+),\s*(-?[\d.]+f?),\s*(false|true)\);'
 constructors=[]
 for match in re.finditer(pattern,text,re.S):
  name,index,x,y,side=match.groups()
  constructors.append({'name':name,'objectId':int(index)+1,'x':x,'y':y,'side':side=='true','sourceLine':first+text[:match.start()].count('\n'),'position':match.start()})
 need(len(constructors)==21,'src/Logger/Logger.cpp',first,'unsupported goal constructor inventory')
 definitions=[];writes=[];calls=[]
 def create(proto,context,offset):
  x=proto['x'];random=re.fullmatch(r'random_float\(([^,]+),\s*([^)]*)\)',x)
  if random:
   endpoints=[v.strip() for v in random.groups()];index=len(calls)
   raw=f'outrun-goal-offsets/v1\n{compat.PIN}\n0\n{index}\n'.encode()
   n=int.from_bytes(hashlib.sha256(raw).digest()[:3],'big');unit=n/16777216
   a,b=[q(float(v.rstrip('f'))) for v in endpoints]
   value=q(a+q(q(b-a)*unit))
   # Call line points to random_float itself, independently of constructor line.
   callline=first+text[:text.index(x,proto['position'])].count('\n')
   calls.append({'index':index,'sourceLine':callline,'context':context,'objectId':proto['objectId'],
                 'endpointTokens':endpoints,'unitInteger':n,'unitValue':unit,'portedBits':_bits(value)})
  elif x in ('offsetPublic','-offsetPublic'):value=q(offset if x=='offsetPublic' else -offset)
  else:value=q(float(x.rstrip('f')))
  result=len(definitions)
  definitions.append({'id':result,'kind':'goal','sourceLine':proto['sourceLine'],'objectId':proto['objectId'],
                      'offsetX':value,'offsetY':q(float(proto['y'].rstrip('f'))),'side':proto['side'],'viewportYFactor':0})
  return result
 def add(segment,slot,definition):writes.append({'segment':segment,'slot':SLOTS[slot],'definition':definition})
 # Each conditional branch's own constructors/calls, respecting else-if priority.
 branches=[]
 for m in re.finditer(r'(?:if|else if) \(i % (\d+) == 0\)',text):
  branches.append((int(m.group(1)),m.start()))
 for b,(divisor,start) in enumerate(branches):
  end=branches[b+1][1] if b+1<len(branches) else text.index('SpriteInfo* publicLeft')
  body=text[start:end];protos=[p for p in constructors if start<=p['position']<end]
  branches[b]=(divisor,protos,re.findall(r'm.addSpriteInfo\(i,\s*(\w+),\s*Sprite_Position::(\w+),\s*false\)',body))
 public=[p for p in constructors if p['name'] in ('publicLeft','publicRight')]
 j=250;offset=q(1.31)
 for i in range(250,669):
  if i>=270:
   for divisor,protos,adds in branches:
    if i%divisor==0:
     ids={p['name']:create(p,f'i={i}:{p["name"]}',offset) for p in protos}
     for name,slot in adds:add(i,slot,ids[name])
     break
  for proto,slot in zip(public[:2],['FAR_LEFT','FAR_RIGHT']):add(j,slot,create(proto,f'i={i}:{proto["name"]}',offset))
  if j<668:j+=3
 for i in range(668,682):
  for proto,slot in zip(public[2:],['FAR_LEFT','FAR_RIGHT']):add(i,slot,create(proto,f'contract={i}:{proto["name"]}',offset))
  offset=q(offset-q(.1))
 final={p['name']:create(p,f'final:{p["name"]}',offset) for p in constructors if p['name'] in ('flagger','logRight','logLeft','endFlag')}
 for segment,name,slot in re.findall(r'm.addSpriteInfo\((\d+),\s*(\w+),\s*Sprite_Position::(\w+),\s*false\)',text):
  add(int(segment),slot,final[name])
 need(len(definitions)==938 and len(writes)==941 and len(calls)==51,'src/Logger/Logger.cpp',first,'goal recipe output inventory changed')
 return definitions,writes,calls

def goal_recipe(fixture,compat):
 """Return construction identities and ordered writes, never sorted/folded."""
 _validate(fixture,compat)
 definitions,writes,calls=_expand(fixture,compat)
 compat.need(_same(fixture['randomCalls'],calls),'goal-source.json',1,'goal random calls/order/endpoint/sample/bit mismatch')
 return {'definitions':definitions,'writes':writes}
