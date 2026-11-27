import {renderTest,expect} from '@gameengine/test';
import {assets,meshes,ViewInfo} from '@gameengine/runtime';
import {EnvironmentReview,EnvironmentResidency} from '../../src/schema.gen.ts';
import {loadSourceBiome} from '../../src/content/biome.ts';
import {destinationEnvironment,destinationDataGroup,DESTINATION_ENVIRONMENT_IDS} from '../../src/content/environments/destination-environments.ts';
import {environmentPresentationStats} from '../../src/render/environment-presentation.ts';
import {sourceProjectionStats} from '../../src/render/source-projection.ts';
import {MAP01_PANORAMA_HEIGHT_PX,MAP01_PANORAMA_REFERENCE_HEIGHT} from '../../src/render/map01-art-backgrounds.ts';

// Source audit: all30 pinned source panoramas have alpha0 at EVERY column in
// rows0..5 (goal back transparent RGBblack, others RGBwhite). These checks do
// not replace the separate positive opaque GPU mapping tests for all30 images.
const PIN='6882721c99bc79365f815f68d389bf5078129e68';
const views=[
  {width:882,height:344,insets:[44,0,0,21]},
  {width:852,height:393,insets:[44,0,0,21]},
  {width:1080,height:810,insets:[44,0,0,21]},
  {width:1280,height:720,insets:[44,0,0,21]},
  {width:720,height:540,insets:[44,0,0,21]},
  {width:882,height:344,insets:[0,21,44,0]},
] as const;

for(const mapId of DESTINATION_ENVIRONMENT_IDS){
  renderTest(`environment.panoramaDestination map${mapId} first covered source rows stay own sky across landscape sizes`,async ctx=>{
    const manifest=destinationEnvironment(mapId);
    expect(manifest.sourceCommit).toBe(PIN);
    expect(manifest.back.sizePx).toEqual([mapId===16?2182:1536,256]);expect(manifest.front.sizePx).toEqual([2048,256]);
    ctx.world.setResource(EnvironmentReview,{enabled:true,mapId,mode:0,batch:0,cameraOriginZ:0,lateral:0,trafficCount:0,backOffset:1000,frontOffset:1000});
    const observations:unknown[]=[];
    for(const sample of views){
      const {width,height,insets}=sample;
      ctx.input.view(width,height,1,[...insets]);await ctx.step(1);
      for(let tick=0;tick<240&&!ctx.world.resource(EnvironmentResidency).renderSettled;tick++)await ctx.step(1);
      const state=ctx.world.resource(EnvironmentResidency),view=ctx.world.resource(ViewInfo);
      expect(state.failed).toBe(false);expect(state.ioReady).toBe(true);expect(state.renderSettled).toBe(true);expect(state.active).toBe(mapId);
      expect(view.width).toBe(width);expect(view.height).toBe(height);
      for(const name of [manifest.assetId,destinationDataGroup(mapId),'environment-review-shared']){
        const group=assets.stats().groups[name]!;expect(group.status).toBe('loaded');expect(group.progress).toBe(1);expect(group.failed).toEqual([]);
      }
      expect(environmentPresentationStats.mapId).toBe(mapId);expect(environmentPresentationStats.mode).toBe(0);
      expect(environmentPresentationStats.geometry.queriedWindow).toBe(0);expect(environmentPresentationStats.geometry.props).toBe(0);expect(environmentPresentationStats.geometry.trafficSelected).toBe(0);
      expect(meshes.info('environment-back')!.vertices).toBe(4);expect(meshes.info('environment-front')!.vertices).toBe(4);
      // Owner already requested/primed actual immutable data outside frame IO.
      const data=loadSourceBiome(mapId);expect(data.sourceCommit).toBe(PIN);
      expect(data.objectOffsets[200]!-data.objectOffsets[0]!).toBe(0);
      expect(sourceProjectionStats.cameraOriginZ).toBe(0);
      const top=sourceProjectionStats.horizonY+MAP01_PANORAMA_HEIGHT_PX*2/MAP01_PANORAMA_REFERENCE_HEIGHT;
      expect(top<1).toBe(true);
      const first=Math.ceil((1-top)*height/2-.5);
      expect(first>0&&first<height-2).toBe(true);
      const xs:number[]=[];
      for(const fraction of [.125,.3125,.5,.6875,.875])xs.push(Math.floor(width*fraction));
      const wraps:{layer:string;width:number;visible:boolean;seamX:number}[]=[];
      for(const layer of ['back','front'] as const){
        const textureWidth=manifest[layer].sizePx[0],seam=(textureWidth-1000)*height/720-.5;
        const visible=seam>=1&&seam<width-2;wraps.push({layer,width:textureWidth,visible,seamX:seam});
        if(visible)for(const x of [Math.floor(seam),Math.floor(seam)+1])if(!xs.includes(x))xs.push(x);
      }
      // Five ordinary x values plus at most four layer-wrap values => <=27
      // points, safely below the supported64-point public GPU probe bound.
      const points:[number,number][]=[];
      for(const x of xs)for(const y of [first-1,first,first+1])points.push([x,y]);
      expect(points.length<=64).toBe(true);
      // The minified source footprint through first+1 stays in audited rows0..5.
      const sourceV=(top-(1-2*(first+1+.5)/height))*360;
      expect(sourceV>=0&&sourceV<5).toBe(true);
      const stats=ctx.render.stats({width,height});expect(stats.drawCalls>0).toBe(true);
      expect('validationErrors' in stats).toBe(true);if('validationErrors' in stats)expect(stats.validationErrors).toEqual([]);
      const pixels=ctx.render.probe({width,height,points}).points,colors:number[][]=[];
      for(let i=0;i<xs.length;i++){
        const sky=pixels[i*3]!.rgba;
        expect(sky[3]).toBe(255);expect(sky[0]!+sky[1]!+sky[2]!).toBeGreaterThan(0);
        expect(pixels[i*3+1]!.rgba).toEqual(sky);expect(pixels[i*3+2]!.rgba).toEqual(sky);
        colors.push(Array.from(sky));
      }
      observations.push({width,height,insets:Array.from(insets),mapId,skySource:Array.from(data.palette[0]!),first,top,sourceV,xs,wraps,actualSky:colors});
    }
    console.log('ENVIRONMENT_PANORAMA_BOUNDARY',{mapId,sourceCommit:PIN,viewportChecks:observations.length,observations,scope:'Actual transparent top-edge equality; separate positive panorama GPU mapping remains required. Insets do not certify future HUD layout.'});
  },{scene:'scenes/destination-environment.scene.json',memory:'phone-low'});
}
