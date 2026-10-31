import {renderTest,expect} from '@gameengine/test';
import {assets,EnterScene,meshes,textures} from '@gameengine/runtime';
import {EnvironmentReview,EnvironmentResidency,DrivingState,TrafficPool} from '../../src/schema.gen.ts';
import {destinationEnvironment,destinationDataGroup} from '../../src/content/environments/destination-environments.ts';
import {createEnvironmentOcclusionFixture} from '../../src/render/environment-occlusion.ts';

for(const [width,height] of [[1280,720],[852,393]] as const){
  renderTest(`environment.occlusion imported Map10 both page and traffic painter orders at ${width}x${height}`,async ctx=>{
    ctx.input.view(width,height,1);
    ctx.world.setResource(EnvironmentReview,{enabled:true,mapId:10,mode:3,batch:0,trafficCount:0});
    await ctx.step(1);
    for(let tick=0;tick<180&&!ctx.world.resource(EnvironmentResidency).renderSettled;tick++)await ctx.step(1);
    const state=ctx.world.resource(EnvironmentResidency);
    expect(state.failed).toBe(false);expect(state.ioReady).toBe(true);expect(state.renderSettled).toBe(true);expect(state.active).toBe(10);
    const manifest=destinationEnvironment(10);
    for(const name of [manifest.assetId,destinationDataGroup(10),'environment-review-shared']){
      const group=assets.stats().groups[name]!;expect(group.status).toBe('loaded');expect(group.progress).toBe(1);expect(group.failed).toEqual([]);
    }
    const before=ctx.world.resource(DrivingState);expect(ctx.world.count(TrafficPool)).toBe(0);
    const fixture=createEnvironmentOcclusionFixture().build(manifest,width,height);
    expect(fixture.probes.count).toBe(9);
    const points:[number,number][]=[];
    for(let i=0;i<9;i++)points.push([fixture.probes.probeX[i]!,fixture.probes.probeY[i]!]);
    for(let i=0;i<9;i++)points.push([fixture.probes.controlX[i]!,fixture.probes.controlY[i]!]);
    const stats=ctx.render.stats({width,height});expect(stats.drawCalls>0).toBe(true);
    expect('validationErrors' in stats).toBe(true);
    if('validationErrors' in stats)expect(stats.validationErrors).toEqual([]);
    const actual=ctx.render.probe({width,height,points}).points;
    for(let i=0;i<9;i++){
      expect(actual[i]!.rgba).toEqual(actual[i+9]!.rgba);
      expect(actual[i]!.rgba[3]).toBe(255);
      expect(actual[i]!.rgba[0]+actual[i]!.rgba[1]+actual[i]!.rgba[2]).toBeGreaterThan(0);
    }
    // Three independent controls must remain distinguishable after actual target
    // conversion, otherwise an incorrectly selected binding could pass equality.
    for(const [a,b] of [[0,1],[0,2],[1,2]] as const)expect(JSON.stringify(actual[a+9]!.rgba)===JSON.stringify(actual[b+9]!.rgba)).toBe(false);
    expect(ctx.world.resource(DrivingState)).toEqual(before);expect(ctx.world.count(TrafficPool)).toBe(0);
    console.log('ENVIRONMENT_IMPORTED_OCCLUSION',{width,height,witnesses:fixture.witnesses.map(w=>({...w,rgba:Array.from(w.rgba),sourcePixelPx:Array.from(w.sourcePixelPx)})),pairs:actual.map(p=>p.rgba)});
    ctx.input.emit(EnterScene,{scene:'scenes/road-proof.scene.json',release:''});await ctx.step(2);
    const exited=ctx.world.resource(EnvironmentResidency);
    expect(exited.ownsActive).toBe(false);expect(exited.ownsIncoming).toBe(false);expect(exited.ownsTraffic).toBe(false);
    expect(assets.stats().groups[manifest.assetId]!.status).toBe('released');
    expect(assets.stats().groups[destinationDataGroup(10)]!.status).toBe('unloaded');
    expect(assets.stats().groups['environment-review-shared']!.status).toBe('released');
    expect(meshes.info('environment-composite')).toBe(null);expect(textures.info('environment-source-controls')).toBe(null);
    for(const name of ['biome-map01-data','biome-catalog-data'])expect(assets.stats().groups[name]!.status).toBe('loaded');
  },{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});
}
