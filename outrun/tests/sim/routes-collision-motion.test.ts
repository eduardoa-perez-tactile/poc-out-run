import {worldTest,expect} from '@gameengine/test';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import {sweptRouteContact,routeCollisionPose} from '../../src/sim/route-collision-motion.ts';
import type {CollisionPlayerMotion,CollisionTrafficMotion} from '../../src/sim/collision-motion.ts';
import {boundTerrainLateral} from '../../src/sim/terrain-math.ts';

const data=originalRouteSources().get(2,0),length=data.totalCount*150;
const pointHull={halfWidth:0,halfLength:0};
function player(z0:number,z1:number):CollisionPlayerMotion{
  return{kind:'player',z0,z1,l0:0,ls:0,lc:0,lr:0,lf:0,drift:0,previousGap:0,carryApplied:false};
}
function traffic(z0:number,z1:number,side:0|1=0):CollisionTrafficMotion{
  return{kind:'traffic',z0,z1,offset0:0,offset1:0,side};
}
worldTest('routes.collisionMotion visible positive aliases contact in the same canonical domain',()=>{
  const hit=sweptRouteContact(player(10000,10020),pointHull,traffic(length+10000,length+10010),pointHull,data);
  expect(hit?.toi).toBe(0);expect(hit?.a.z).toBe(10000);expect(hit?.b.z).toBe(10000);
  const raw=16777217,canonical=raw%length;
  const precise=sweptRouteContact(player(canonical,canonical),pointHull,traffic(raw,raw),pointHull,data);
  expect(precise?.b.z).toBe(canonical);
  expect(routeCollisionPose(traffic(raw,raw),true,data).z).toBe(canonical);
});
worldTest('routes.collisionMotion source wrap never sweeps a false chord through the road middle',()=>{
  expect(sweptRouteContact(player(length-10,length+10),pointHull,
    {kind:'static',x:0,z:length/2},pointHull,data)).toBe(null);
  const before=sweptRouteContact(player(length-10,length+10),pointHull,
    {kind:'static',x:0,z:length-5},pointHull,data);
  const after=sweptRouteContact(player(length-10,length+10),pointHull,
    {kind:'static',x:0,z:5},pointHull,data);
  expect(before?.toi).toBe(.25);expect(after?.toi).toBe(.75);
});
worldTest('routes.collisionMotion simultaneous wraps retain the closed incoming endpoint for unequal raw laps',()=>{
  const hit=sweptRouteContact(player(length-10,length),pointHull,
    traffic(2*length-20,2*length),pointHull,data);
  expect(hit?.toi).toBe(1);expect(hit?.stage).toBe('pre-jump');
  expect(hit?.a.z).toBe(length);expect(hit?.b.z).toBe(length);
});
worldTest('routes.collisionMotion both actors land atomically after a wrap before endpoint occupancy',()=>{
  expect(data.segments[0]!.gap).toBe(0);expect(data.segments[data.totalCount-1]!.gap).toBe(110);
  const hit=sweptRouteContact(player(length-10,length),pointHull,
    traffic(2*length-20,2*length,1),pointHull,data);
  expect(hit?.toi).toBe(1);expect(hit?.stage).toBe('post-jump');
  expect(hit?.a).toEqual({x:0,z:0});expect(hit?.b).toEqual({x:0,z:0});
});
worldTest('routes.collisionMotion reverse wraps preserve real endpoint hits without a skipped-middle sweep',()=>{
  expect(sweptRouteContact(player(length+10,length-10),pointHull,
    {kind:'static',x:0,z:length/2},pointHull,data)).toBe(null);
  expect(sweptRouteContact(player(length+10,length-10),pointHull,
    {kind:'static',x:0,z:5},pointHull,data)?.toi).toBe(.25);
  expect(sweptRouteContact(player(length+10,length-10),pointHull,
    {kind:'static',x:0,z:length-5},pointHull,data)?.toi).toBe(.75);
  expect(()=>sweptRouteContact(player(0,length+1),pointHull,traffic(0,0),pointHull,data)).toThrow();
});
worldTest('routes.collisionMotion exact reverse boundary starts land before continuous reverse movement',()=>{
  const hit=sweptRouteContact(player(length,length-10),pointHull,
    {kind:'static',x:0,z:length-5},pointHull,data);
  expect(hit?.toi).toBe(.5);expect(hit?.a.z).toBe(length-5);
});
worldTest('routes.collisionMotion stale gap final correction and bounds never add a lateral sweep',()=>{
  const index=data.segments.findIndex((r,i)=>i>0&&r.gap!==data.segments[i-1]!.gap);
  expect(index>0).toBe(true);
  const previousGap=originalRouteSources().get(1,0).segments[0]!.gap;
  const end=data.segments[index]!,lc=Math.fround(Math.fround(end.gap-previousGap)/1600);
  const lf=boundTerrainLateral(lc,end.gap,end.mirror,0);
  expect(lc<lf).toBe(true);
  const motion={...player(index*150-1,index*150),carryApplied:true,previousGap,lc,lr:lc,lf};
  const skippedX=Math.fround(Math.fround((lc+lf)/2)*1600);
  expect(sweptRouteContact(motion,pointHull,{kind:'static',x:skippedX,z:index*150},pointHull,data)).toBe(null);
  const final=sweptRouteContact(motion,pointHull,{kind:'static',x:Math.fround(lf*1600),z:index*150},pointHull,data);
  expect(final?.toi).toBe(1);expect(final?.stage).toBe('final-bound');
});
worldTest('routes.collisionMotion distinct integer rational knots sharing f32 time keep their positive interval',()=>{
  const source=originalRouteSources().get(1,0),boundary=4123*150;
  const earlier=(boundary-134)/(899939-134),later=boundary/900000;
  expect(earlier<later).toBe(true);expect(Math.fround(earlier)).toBe(Math.fround(later));
  const l0=Math.fround(source.segments[0]!.gap/1600),end=source.segments[6000]!;
  const lc=Math.fround(l0+Math.fround((end.gap-source.segments[0]!.gap)/1600));
  const p={...player(0,900000),l0,ls:l0,lc,lr:lc,lf:lc,previousGap:source.segments[0]!.gap,carryApplied:true};
  const car={...traffic(134,899939,1),offset0:Math.fround(-68/1600),offset1:Math.fround(-68/1600)};
  const tiny={halfWidth:.1,halfLength:.01};
  // Bounded long-motion numeric stress fixture: actual source gap jump, integer
  // endpoints, no patched rows. It is not a possible single normal driving tick.
  const hit=sweptRouteContact(p,tiny,car,tiny,source)!;
  expect(hit.toi).toBe(Math.fround(earlier));expect(hit.stage).toBe('post-jump');
  expect(Math.abs(hit.a.x-hit.b.x)).toBeLessThan(.2);
});
