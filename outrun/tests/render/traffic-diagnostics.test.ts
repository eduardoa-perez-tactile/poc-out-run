import {renderTest,expect} from '@gameengine/test';
import {EnterScene,assets} from '@gameengine/runtime';
import {DrivingState,DrivingResetRequested,TerrainDriver,TrafficPool,TrafficResetRequested} from '../../src/schema.gen.ts';
import {sourcePlayerSample,loadMap01} from '../../src/content/biome.ts';
import {clearTrafficDiagnostics,type TrafficDiagnosticsHost} from '../../src/render/traffic-diagnostics.ts';

renderTest('traffic.diagnostics integrated probe mirrors the live owner without changing race state and clears on exit',async({world,input,step,render})=>{
  const host=globalThis as unknown as TrafficDiagnosticsHost,old=host.gameengineProbe;
  try{
    // Explicit native fixture for the public browser-probe gate, not browser evidence.
    host.gameengineProbe={state:()=>({})};input.view(1280,720,1);await step(1);
    render.probe({width:1280,height:720,points:[[0,0]]});await step(1);
    for(let frame=0;frame<120&&['map01-environment','traffic-source','player-ferrari1'].some(name=>assets.progress(name)<1);frame++)await step(1);
    input.emit(DrivingResetRequested,{manual:false,legacySpeed:0,distance:100000,lateral:0});
    input.emit(TrafficResetRequested,{mapId:1,population:32,seedLo:305419896,seedHi:2596069104,originZ:75000});await step(1);
    render.stats({width:1280,height:720});
    const owner=world.entities(TrafficPool)[0]!,terrain=world.entities(TerrainDriver)[0]!;
    const driving=world.resource(DrivingState),pool=world.get(owner,TrafficPool),api=host.outrunTrafficProbe!;
    expect(!!api).toBe(true);const dto=api.snapshot()!;expect(dto.ready).toBe(true);
    expect(dto.population).toBe(pool.population);expect(dto.epoch).toBe(pool.epoch);expect(dto.mapId).toBe(pool.mapId);
    expect(dto.driver.distance).toBe(driving.distance);expect(dto.driver.roadSide).toBe(world.get(terrain,TerrainDriver).roadSide);
    expect(dto.driver.playerZ).toBe(sourcePlayerSample(loadMap01(),driving.distance).playerZ);
    expect(dto.visibleCount).toBeGreaterThan(0);expect(dto.cars.length).toBe(32);
    for(let frame=0;frame<3;frame++)render.stats({width:1280,height:720});
    expect(world.resource(DrivingState)).toEqual(driving);expect(world.get(owner,TrafficPool)).toEqual(pool);
    expect(api.snapshot()!.step).toBe(dto.step);
    input.emit(EnterScene,{scene:'scenes/map01-art.scene.json',release:''});await step(2);
    render.stats({width:1280,height:720});expect(host.outrunTrafficProbe).toBe(undefined);expect(api.snapshot()).toBe(null);
  }finally{clearTrafficDiagnostics(host);if(old===undefined)delete host.gameengineProbe;else host.gameengineProbe=old;}
},{scene:'scenes/driving-traffic.scene.json',memory:'phone-low'});
