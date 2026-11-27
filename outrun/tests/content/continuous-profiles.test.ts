import {worldTest,expect} from '@gameengine/test';
import type {SourceBiomeId} from '../../src/content/biome.ts';
import type {OriginalRouteGradient} from '../../src/content/route-profiles.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import {createContinuousRouteSources} from '../../src/content/continuous-profiles.ts';

worldTest('routes.continuous all16 source maps retain authored rows and props with two source straight reliefs',()=>{
  const original=originalRouteSources(),continuous=createContinuousRouteSources(original);
  expect(continuous.catalog===original.catalog).toBe(true);
  const shared=['objects','definitions','placements','palette','commands','sourceHashes','links','overwritten']as const;
  for(let id=1;id<=16;id++){
    const mapId=id as SourceBiomeId,base=original.get(mapId,0),view=continuous.get(mapId,0),authored=base.authoredCount;
    expect(view.totalCount).toBe(authored+1200);expect(view.lastLine).toBe(authored+1000);
    expect(view.swapLine).toBe(authored+301);expect(view.forkGradient).toBe(0);
    expect(view.profile).toBe('sourceCompatibility-original');
    expect(view.objectOffsets.length).toBe(view.totalCount+1);
    expect(view.objectOffsets[view.totalCount]).toBe(base.placements.length);
    for(const key of shared)expect(view[key]===base[key]).toBe(true);
    for(let n=0;n<authored;n++)if(view.segments[n]!==base.segments[n])throw new Error('Authored source row was replaced');
    const terminal=base.segments[authored-1]!;
    for(let n=authored;n<view.totalCount;n++){
      const row=view.segments[n]!;
      if(row.y0!==terminal.y1||row.y1!==terminal.y1||row.curve!==0||row.gap!==terminal.gap||
        row.mirror||row.light!==Math.floor(n/3)%2||!Object.isFrozen(row))throw new Error(`Continuous source tail differs at map${id}/row${n}`);
    }
    expect(Object.isFrozen(view)&&Object.isFrozen(view.segments)&&Object.isFrozen(view.objectOffsets)).toBe(true);
    expect(continuous.get(mapId,0)===view).toBe(true);
  }
});

worldTest('routes.continuous immutable lookup rejects invalid maps and nonzero gradients',()=>{
  const continuous=createContinuousRouteSources(originalRouteSources()),goal=continuous.get(16,0);
  expect(Object.isFrozen(continuous)).toBe(true);expect(goal.totalCount).toBe(2250);
  expect(goal.swapLine).toBe(1351);expect(goal.lastLine).toBe(2050);
  expect(Reflect.set(goal,'lastLine',0)).toBe(false);
  for(const id of [0,17,.5,NaN,Infinity,true])expect(()=>continuous.get(id as SourceBiomeId,0)).toThrow();
  for(const gradient of [-1,1,.5,NaN,Infinity,true])expect(()=>continuous.get(1,gradient as OriginalRouteGradient)).toThrow();
});
