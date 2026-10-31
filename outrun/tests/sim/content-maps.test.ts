import {worldTest,expect} from '@gameengine/test';
import {listData} from '@gameengine/runtime';
import {SourceBiome} from '../../src/schema.gen.ts';
import {loadSourceBiome,type SourceBiomeId} from '../../src/content/biome.ts';

// Independent oracles: pinned map.txt records, PNG IHDRs and optional property
// files; source expansion rules are documented in docs/content/source-biomes.md.
const PIN='6882721c99bc79365f815f68d389bf5078129e68';
const SCENE={scene:'scenes/map01-data.scene.json'};
const cases=[
  {id:2,authored:4605,total:6565,swap:4766,last:6365,objects:36,properties:30,
    definitions:196,candidates:4491,winners:3692,overwrites:799,density:237,time:170,
    links:{left:4,right:5,sequential:3},checkpointObjects:[35,36],checkpointLine:53,
    winnerDefinition:4,winnerSourceLine:62,curveStart:300,curveHold:340,curveLeave:460,
    hillStart:1955,hillEffective:[60,70,60],hillSourceLine:38,
    mapSha:'57440fafc25c8513979b94d340fad6d3993a3f6255b2b356c54d90e0d128812b',
    palette:[[0,128,246,255],[132,188,27,255],[163,218,60,255],[105,71,67,255],[139,105,101,255],[105,71,67,255],[247,247,247,255],[105,71,67,255],[247,247,247,255],[247,247,247,255],[139,105,101,255]]},
  {id:3,authored:4920,total:6880,swap:5081,last:6680,objects:39,properties:29,
    definitions:148,candidates:4153,winners:3702,overwrites:451,density:396,time:160,
    links:{left:5,right:6,sequential:4},checkpointObjects:[38,39],checkpointLine:51,
    winnerDefinition:6,winnerSourceLine:64,curveStart:360,curveHold:400,curveLeave:650,
    hillStart:2900,hillEffective:[50,60,50],hillSourceLine:37,
    mapSha:'43ece1d375b9958551f2d3be1b450637a4ea79a9c4938903cbd59453a244e634',
    palette:[[126,228,239,255],[98,154,0,255],[134,186,0,255],[68,68,68,255],[68,68,68,255],[68,68,68,255],[247,247,247,255],[68,68,68,255],[247,247,247,255],[247,247,247,255],[68,68,68,255]]},
] as const;
for(const oracle of cases){
  worldTest(`content.biome${oracle.id} typed immutable source inventory and full placement prefixes`,()=>{
    const data=loadSourceBiome(oracle.id);
    expect([...listData(SourceBiome)].sort()).toEqual([
      'data/biomes/map01.json','data/biomes/map02.json','data/biomes/map03.json',
    ]);
    expect(data.id).toBe(oracle.id);expect(data.sourceCommit).toBe(PIN);
    expect(data.sourceHashes[`Resources/Maps/MapLevels/Map${oracle.id}/map.txt`]).toBe(oracle.mapSha);
    expect(data.profile).toBe('sourceCompatibility-original');expect(data.forkGradient).toBe(0);
    expect(data.segmentLength).toBe(150);expect(data.playerOffsetZ).toBe(702);
    expect(data.cameraHeight).toBe(800);expect(data.referenceWidth).toBe(921);
    expect(data.authoredCount).toBe(oracle.authored);expect(data.totalCount).toBe(oracle.total);
    expect(data.segments.length).toBe(oracle.total);expect(data.swapLine).toBe(oracle.swap);expect(data.lastLine).toBe(oracle.last);
    expect(data.timeSeconds).toBe(oracle.time);expect(data.terrain).toBe(2);expect(data.roadTerrain).toBe(0);
    expect(data.links).toEqual(oracle.links);expect(data.palette).toEqual(oracle.palette);
    expect(data.objects.length).toBe(oracle.objects);expect(data.objects.filter(o=>o.hasProperties).length).toBe(oracle.properties);
    expect(data.definitions.length).toBe(oracle.definitions);expect(data.definitions.every(d=>d.kind==='authored')).toBe(true);
    expect(data.candidatePlacements).toBe(oracle.candidates);expect(data.placements.length).toBe(oracle.winners);
    expect(data.overwritten.length).toBe(oracle.overwrites);expect(data.maxWindowProps).toBe(oracle.density);
    expect(Object.isFrozen(data)).toBe(true);expect(Object.isFrozen(data.segments[0])).toBe(true);
    expect(Object.isFrozen(data.objects[0])).toBe(true);
    const used=new Set(data.definitions.map(d=>d.objectId));expect(used.size).toBe(oracle.objects);
    for(let i=0;i<oracle.objects;i++){
      expect(data.objects[i]!.id).toBe(i+1);
      expect(data.objects[i]!.sourcePath).toBe(`Resources/Maps/MapLevels/Map${oracle.id}/${i+1}.png`);
      expect(used.has(i+1)).toBe(true);
    }
    expect(data.objectOffsets.length).toBe(oracle.total+1);expect(data.objectOffsets[0]).toBe(0);
    expect(data.objectOffsets[oracle.total]).toBe(oracle.winners);
    let cursor=0,maximum=0;
    for(let row=0;row<oracle.total;row++){
      expect(data.objectOffsets[row]).toBe(cursor);
      const end=data.objectOffsets[row+1]!;let previousSlot=-1;
      for(;cursor<end;cursor++){
        const p=data.placements[cursor]!;
        expect(p.segment).toBe(row);expect(p.id).toBe(row*5+p.slot);
        expect(p.slot>previousSlot&&p.slot<5).toBe(true);previousSlot=p.slot;
        expect(p.definition>=0&&p.definition<oracle.definitions).toBe(true);
      }
      maximum=Math.max(maximum,data.objectOffsets[Math.min(oracle.total,row+200)]!-data.objectOffsets[row]!);
    }
    expect(cursor).toBe(oracle.winners);expect(maximum).toBe(oracle.density);
  },SCENE);

  worldTest(`content.biome${oracle.id} source relief phase boundaries and authentic ORIGINAL tail`,()=>{
    const data=loadSourceBiome(oracle.id),rows=data.segments;
    expect(rows[0]).toEqual({y0:0,y1:0,curve:0,gap:0,mirror:false,light:0});
    expect(rows[203]!.y0).toBe(0);expect(rows[203]!.y1).toBe(0);
    // Source first rising hill midpoint: slope*150/2 (preceding terrain flat).
    expect(rows[oracle.id===2?1525:1970]!.y1).toBe(oracle.id===2?3750:1500);
    // Per-row integer gap increments: trunc(1036/160)=6; trunc(2072/220)=9.
    expect(rows[oracle.id===2?1264:909]!.gap).toBe(oracle.id===2?960:1980);
    // First curve: enter40, held120/250 after source factor3/5. Half-entry
    // is exactly -1.5*(20/40)^2; no trig tolerance or Map1 exception reused.
    expect(rows[oracle.curveStart-1]!.curve).toBe(0);
    expect(rows[oracle.curveStart]!.curve).toBe(0);
    expect(rows[oracle.curveStart+20]!.curve).toBe(-.375);
    expect(rows[oracle.curveHold]!.curve).toBe(-1.5);
    expect(rows[oracle.curveLeave-1]!.curve).toBe(-1.5);
    expect(rows[oracle.curveLeave]!.curve).toBe(-1.5);
    expect(rows[oracle.curveLeave+40]!.curve).toBe(0);
    const hill=data.commands.find(c=>c.firstSegment===oracle.hillStart)!;
    expect(hill.sourceLine).toBe(oracle.hillSourceLine);expect(hill.effective).toEqual(oracle.hillEffective);
    expect(hill.count).toBe(oracle.id===2?190:160);
    expect(hill.arguments[2]).toBe(oracle.id===2?50:80); // Authored leave is intentionally ignored.
    expect(rows[oracle.authored-1]!.mirror).toBe(false);
    expect(rows[oracle.authored]!.mirror).toBe(true);expect(rows[oracle.authored]!.curve).toBe(0);
    expect(rows[oracle.authored+10]!.curve).toBe(-2);
    expect(rows[oracle.swap-1]!.mirror).toBe(true);expect(rows[oracle.swap]!.mirror).toBe(true);
    expect(rows[oracle.authored+659]!.mirror).toBe(true);
    expect(rows[oracle.authored+660]!.mirror).toBe(false);
    expect(rows[oracle.last]!.mirror).toBe(false);
    expect(rows[oracle.total-1]!.mirror).toBe(false);expect(rows[oracle.total-1]!.curve).toBe(0);
    for(let i=0;i<rows.length;i++){
      const row=rows[i]!;
      expect([row.y0,row.y1,row.curve,row.gap].every(Number.isFinite)).toBe(true);
      expect(row.light).toBe(Math.floor(i/3)%2);
      if(i>0)expect(row.y0).toBe(rows[i-1]!.y1);
    }
  },SCENE);

  worldTest(`content.biome${oracle.id} real checkpoint local pivots defaults and overwrite identity`,()=>{
    const data=loadSourceBiome(oracle.id);
    expect(data.checkpointLine).toBe(203);expect(data.objectOffsets[203]).toBe(0);expect(data.objectOffsets[204]).toBe(2);
    const checkpoint=data.placements.slice(0,2);
    expect(checkpoint.map(p=>[p.id,p.segment,p.slot,p.definition])).toEqual([[1016,203,1,0],[1019,203,4,1]]);
    for(let i=0;i<2;i++){
      const definition=data.definitions[i]!,object=data.objects[oracle.checkpointObjects[i]!-1]!;
      expect(definition.objectId).toBe(oracle.checkpointObjects[i]);expect(definition.sourceLine).toBe(oracle.checkpointLine+i+1);
      expect(definition.offsetX).toBe(Math.fround(i===0?-.4:.4));expect(definition.offsetY).toBe(0);
      expect(definition.side).toBe(i===1);expect(definition.viewportYFactor).toBe(0);
      expect(object.sourceSizePx).toEqual([218,i===0?154:153]);
      expect(object.scale).toBe(Math.fround(.65));expect(object.collisionWidthSourcePx).toBe(14);
      expect(object.collisionPivotLeft).toEqual([Math.fround(.064),1]);
      expect(object.collisionPivotRight).toEqual([Math.fround(oracle.id===2&&i===0?.64:.936),1]);
    }
    const defaults=data.objects[0]!;
    expect(defaults.hasProperties).toBe(false);expect(defaults.sourceSizePx).toEqual([40,128]);
    expect(defaults.collision).toBe(true);expect(defaults.scale).toBe(1);expect(defaults.collisionWidthSourcePx).toBe(40);
    expect(defaults.showTerrain).toBe(0);expect(defaults.pivotLeft).toEqual([1,1]);expect(defaults.pivotRight).toEqual([0,1]);
    expect(defaults.collisionPivotLeft).toEqual([.5,1]);expect(defaults.collisionPivotRight).toEqual([.5,1]);
    const winner=data.placements.find(p=>p.segment===210&&p.slot===1)!;
    expect(winner.id).toBe(1051);expect(winner.definition).toBe(oracle.winnerDefinition);
    expect(data.definitions[winner.definition]!.objectId).toBe(2);
    expect(data.definitions[winner.definition]!.sourceLine).toBe(oracle.winnerSourceLine);
    const first=data.overwritten.find(p=>p.segment===210&&p.slot===1)!;
    expect(first.previousDefinition).toBe(2);expect(first.definition).toBe(4);
    if(oracle.id===3){
      const second=data.overwritten.filter(p=>p.segment===210&&p.slot===1);
      expect(second.map(p=>[p.previousDefinition,p.definition])).toEqual([[2,4],[4,6]]);
    }
  },SCENE);
}
worldTest('content.biome explicit loader rejects unsupported runtime IDs visibly',()=>{
  for(const id of [0,4,16,-1,NaN]){
    let message='';try{loadSourceBiome(id as SourceBiomeId);}catch(error){message=String(error);}
    expect(message).toBe(`Error: Unsupported source biome ${id}`);
  }
},SCENE);
