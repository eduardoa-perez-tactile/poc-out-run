import {worldTest,expect} from '@gameengine/test';
import {math} from '@gameengine/runtime';
import {loadMap01} from '../../src/content/biome.ts';
import {boundTerrainLateral} from '../../src/sim/terrain-math.ts';
import {sweptContact,collisionPose,validatePlayerMotion,type CollisionPlayerMotion,type CollisionTrafficMotion,type CollisionMotion} from '../../src/sim/collision-motion.ts';
const q=math.fround,POINT={halfWidth:0,halfLength:0},TINY={halfWidth:.1,halfLength:.01};
const fixed=(x:number,z:number):CollisionMotion=>({kind:'static',x,z});
function player(z0:number,z1:number,l0:number,ls=l0,drift=0,carryApplied=false,previousGap?:number,lf?:number):CollisionPlayerMotion{
  const data=loadMap01(),g0=data.segments[Math.floor(z0/150)]!.gap,g1=data.segments[Math.floor(z1/150)]!.gap,stored=previousGap??g0;
  const lc=q(q(ls)+(carryApplied?q(q(g1-q(stored))/1600):0)),lr=q(lc+q(drift));
  return {kind:'player',z0:q(z0),z1:q(z1),l0:q(l0),ls:q(ls),lc,lr,lf:q(lf??lr),drift:q(drift),carryApplied,previousGap:q(stored)};
}
function traffic(z0:number,z1:number,side:0|1=0,offset0=0,offset1=offset0):CollisionTrafficMotion{return{kind:'traffic',z0,z1,side,offset0:q(offset0),offset1:q(offset1)};}
worldTest('collision.motion inclusive faces initial overlap zero velocity and high-speed crossing have exact witnesses',()=>{
  const data=loadMap01(),h={halfWidth:10,halfLength:10};
  expect(sweptContact(fixed(0,100),h,fixed(20,120),h,data)!.toi).toBe(0);
  expect(sweptContact(fixed(0,100),h,fixed(20.01,120),h,data)).toBe(null);
  const hit=sweptContact(traffic(0,1000),h,fixed(0,500),h,data)!;
  expect(hit.toi).toBe(q(.48));expect(hit.stage).toBe('continuous');expect(hit.a.z).toBe(480);
  expect(sweptContact(traffic(100,100),h,traffic(120,120),h,data)!.toi).toBe(0);
  expect(sweptContact(traffic(100,200),h,traffic(121,221),h,data)).toBe(null);
});
worldTest('collision.motion real source player and traffic gap jumps never sweep the open median',()=>{
  const data=loadMap01();
  for(const row of [4123,4353,4783]){
    const boundary=row*150,g0=data.segments[row-1]!.gap,g1=data.segments[row]!.gap;
    const p=player(boundary-1,boundary,q(g0/1600),undefined,0,true);
    const x0=q(p.l0*1600),x1=q(p.lr*1600),middle=q((x0+x1)/2);
    expect(sweptContact(p,POINT,fixed(middle,boundary),POINT,data)).toBe(null);
    expect(sweptContact(p,POINT,fixed(x0,boundary),POINT,data)!.stage).toBe('pre-jump');
    expect(sweptContact(p,POINT,fixed(x1,boundary),POINT,data)!.stage).toBe('post-jump');
    const car=traffic(boundary-1,boundary,1);
    expect(sweptContact(car,POINT,fixed(q((g0+g1)/2),boundary),POINT,data)).toBe(null);
    expect(sweptContact(car,POINT,fixed(g1,boundary),POINT,data)!.stage).toBe('post-jump');
    // The left road has no carry even at the same source transition.
    expect(sweptContact(player(boundary-1,boundary,0),POINT,fixed(0,boundary),POINT,data)!.toi).toBe(1);
  }
});
worldTest('collision.motion simultaneous row jumps are atomic including raw LR and final LF at t1',()=>{
  const data=loadMap01(),boundary=4353*150,g0=data.segments[4352]!.gap;
  const p=player(boundary-1,boundary,q(g0/1600),undefined,0,true,undefined,q(g0/1600));
  const car=traffic(boundary-1,boundary,1,q(68/1600));
  // Player rawLR equals traffic OLD X, but that mixed state never exists.
  expect(sweptContact(p,TINY,car,TINY,data)).toBe(null);
  const aligned=traffic(boundary-1,boundary,1,0);
  expect(sweptContact(p,TINY,aligned,TINY,data)!.toi).toBe(0);
});
worldTest('collision.motion stale stored gap zero-Z correction and final clamps are endpoint occupancies only',()=>{
  const data=loadMap01(),z=4353*150;
  const stale=player(z,z,0,0,0,true,0),raw=q(stale.lr*1600);
  expect(raw).toBe(15730);
  expect(sweptContact(stale,POINT,fixed(raw/2,z),POINT,data)).toBe(null);
  expect(sweptContact(stale,POINT,fixed(raw,z),POINT,data)!.stage).toBe('post-jump');
  const noGate=player(z,z,0,0,0,false,0);
  expect(sweptContact(noGate,POINT,fixed(raw,z),POINT,data)).toBe(null);
  const right=boundTerrainLateral(6,data.segments[4353]!.gap,true,1);
  expect(right).toBe(q(8.101249694824219));
  const snap=player(z,z,6,6,0,false,undefined,right);
  expect(sweptContact(snap,POINT,fixed(7*1600,z),POINT,data)).toBe(null);
  expect(sweptContact(snap,POINT,fixed(q(right*1600),z),POINT,data)!.stage).toBe('final-bound');
  const outer=player(z,z,20,20,0,false,undefined,boundTerrainLateral(20,data.segments[4353]!.gap,true,1));
  expect(sweptContact(outer,POINT,fixed(19*1600,z),POINT,data)).toBe(null);
});
worldTest('collision.motion continuous steering and drift remain swept when the tick also snaps',()=>{
  const data=loadMap01(),z=4353*150,p=player(z,z,0,.75,.25,false,undefined,2);
  const hit=sweptContact(p,POINT,fixed(800,z),POINT,data)!;
  expect(hit.stage).toBe('continuous');expect(hit.toi).toBe(.5);expect(hit.a.x).toBe(800);
  const lane=traffic(z,z,0,-1,1);
  expect(sweptContact(lane,POINT,fixed(0,z),POINT,data)!.toi).toBe(.5);
});
worldTest('collision.motion reverse exact start and end boundaries keep source one-sided occupancies',()=>{
  const data=loadMap01(),boundary=4353*150,g0=data.segments[4352]!.gap,g1=data.segments[4353]!.gap;
  const reverse=traffic(boundary,boundary-2,1);
  expect(sweptContact(reverse,POINT,fixed((g0+g1)/2,boundary),POINT,data)).toBe(null);
  expect(sweptContact(reverse,POINT,fixed(g0,boundary),POINT,data)!.stage).toBe('post-jump');
  expect(sweptContact(reverse,POINT,fixed(g1,boundary),POINT,data)!.toi).toBe(0);
  expect(sweptContact(traffic(boundary+2,boundary,1),POINT,fixed(g0,boundary),POINT,data)).toBe(null);
  const interior=sweptContact(traffic(boundary+2,boundary-2,1),POINT,fixed(g0,boundary),POINT,data)!;
  expect(interior.toi).toBe(.5);expect(interior.stage).toBe('post-jump');
});
worldTest('collision.motion distinct events sharing rounded time retain the positive interval between their jumps',()=>{
  const data=loadMap01(),end=900000,boundary=4123*150;
  const earlier=(boundary-.015625)/(end-.015625),later=boundary/end;
  expect(earlier<later).toBe(true);expect(q(earlier)).toBe(q(later));
  const p=player(0,end,q(data.segments[0]!.gap/1600),undefined,0,true);
  const car=traffic(.015625,end,1,q(-68/1600));
  // The traffic jump lands beside the old-row player for a positive interval.
  // Collapsing both events into one rounded-time atomic jump would miss it.
  const hit=sweptContact(p,TINY,car,TINY,data)!;
  expect(hit.toi).toBe(q(earlier));expect(hit.stage).toBe('post-jump');
  expect(Math.abs(hit.a.x-hit.b.x)).toBeLessThan(.2);
});
worldTest('collision.motion multi-row source carry closes direct LC LR LF without accumulating rounded row deltas',()=>{
  const data=loadMap01(),z0=4352*150+100,z1=4354*150+50;
  const p=player(z0,z1,9.5,q(9.5+.03125),q(.0125),true);
  validatePlayerMotion(p,data);
  expect(collisionPose(p,1,4354,data)).toEqual({x:q(p.lf*1600),z:z1});
  const malformed={...p,lc:q(p.lc+.0001)};let threw=false;
  try{validatePlayerMotion(malformed,data);}catch{threw=true;}expect(threw).toBe(true);
  expect(sweptContact({...p,barrier:true},POINT,fixed(q(p.l0*1600),z0),POINT,data)).toBe(null);
});
worldTest('collision.motion departing traffic retains its closed incoming lifetime and excludes all later motion',()=>{
  const data=loadMap01(),limit=data.lastLine*150,z=limit-5,until=5/160;
  const old={...traffic(z,limit+155),activeUntil:until,disappears:true};
  expect(sweptContact(player(z,z,0),POINT,old,POINT,data)!.toi).toBe(0);
  const ph={halfWidth:.1,halfLength:2},before=player(z,z,q(10/1600),q(-1000/1600));
  const contact=sweptContact(before,ph,old,ph,data)!;
  expect(contact.toi).toBeGreaterThan(0);expect(contact.toi).toBeLessThan(until);
  const late=player(z,z,q(100/1600),0),wideZ={halfWidth:1,halfLength:100};
  expect(sweptContact(late,wideZ,traffic(z,limit+155),wideZ,data)!.toi).toBeGreaterThan(until);
  expect(sweptContact(late,wideZ,old,wideZ,data)).toBe(null);
});
worldTest('collision.motion traffic terminal at t1 cannot witness a later player bound landing',()=>{
  const data=loadMap01(),limit=data.lastLine*150;
  const p=player(limit,limit,q(100/1600),undefined,0,false,undefined,0),car=traffic(limit-5,limit);
  expect(sweptContact(p,POINT,car,POINT,data)!.stage).toBe('final-bound');
  expect(sweptContact(p,POINT,{...car,activeUntil:1,disappears:true},POINT,data)).toBe(null);
  // The incoming endpoint itself remains closed when no later operator is needed.
  expect(sweptContact(player(limit,limit,0),POINT,{...car,activeUntil:1,disappears:true},POINT,data)!.stage).toBe('pre-jump');
});
