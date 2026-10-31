import {math} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import type {CollisionHull} from './collision-metadata.ts';
export type {CollisionHull} from './collision-metadata.ts';

const q=math.fround;
export interface CollisionPlayerMotion {
  readonly kind:'player';readonly z0:number;readonly z1:number;
  readonly l0:number;readonly ls:number;readonly lc:number;readonly lr:number;readonly lf:number;
  readonly drift:number;readonly previousGap:number;readonly carryApplied:boolean;readonly barrier?:boolean;
}
export interface CollisionTrafficMotion {
  readonly kind:'traffic';readonly z0:number;readonly z1:number;
  readonly offset0:number;readonly offset1:number;readonly side:0|1;readonly barrier?:boolean;
  readonly activeUntil?:number;readonly disappears?:boolean;
}
export interface TrafficContactDeparture {
  readonly slot:number;readonly epoch:number;readonly generation:number;readonly z0:number;readonly z1:number;
  readonly offset:number;readonly side:0|1;readonly until:number;
}
export interface CollisionStaticMotion {readonly kind:'static';readonly x:number;readonly z:number}
export type CollisionMotion=CollisionPlayerMotion|CollisionTrafficMotion|CollisionStaticMotion;
export interface CollisionPose {readonly x:number;readonly z:number}
export type CollisionStage='continuous'|'pre-jump'|'post-jump'|'final-bound';
export interface CollisionWitness {readonly toi:number;readonly stage:CollisionStage;readonly a:CollisionPose;readonly b:CollisionPose}
interface RowEvent {num:number;den:number;row:number;boundary:number;actor:0|1}
function require(ok:boolean,message:string):asserts ok{if(!ok)throw new Error(`Collision motion: ${message}`);}
function rowAt(z:number,data:ReadonlySourceBiomeData):number{
  const row=Math.floor(q(z)/data.segmentLength);
  require(Number.isFinite(z)&&z>=0&&row>=0&&row<data.segments.length,'Z outside source rows');return row;
}
function endZ(m:CollisionMotion,final:boolean){return m.kind==='static'?q(m.z):q(final?m.z1:m.z0);}
function lerp(a:number,b:number,t:number){return t===0?q(a):t===1?q(b):q(q(a)+q(q(q(b)-q(a))*t));}
function validate(m:CollisionMotion,data:ReadonlySourceBiomeData){
  require(data.segmentLength>0&&Number.isFinite(data.segmentLength),'invalid segment length');
  rowAt(endZ(m,false),data);rowAt(endZ(m,true),data);
  if(m.kind==='player')validatePlayerMotion(m,data);
  else if(m.kind==='traffic'){
    require(Number.isFinite(m.offset0)&&Number.isFinite(m.offset1),'nonfinite traffic offset');
    require(m.side===0||m.side===1,'invalid traffic side');
    if(m.disappears||m.activeUntil!==undefined)require(m.disappears===true&&m.activeUntil!==undefined&&Number.isFinite(m.activeUntil)&&m.activeUntil>=0&&m.activeUntil<=1,'invalid terminal lifetime');
  }else require(Number.isFinite(m.x),'nonfinite static X');
}
export function validatePlayerMotion(m:CollisionPlayerMotion,data:ReadonlySourceBiomeData):void{
  for(const n of [m.l0,m.ls,m.lc,m.lr,m.lf,m.drift,m.previousGap])require(Number.isFinite(n),'nonfinite player operand');
  rowAt(m.z0,data);const row=rowAt(m.z1,data);
  const carry=m.carryApplied?q(q(data.segments[row]!.gap-q(m.previousGap))/1600):0;
  require(q(q(m.ls)+carry)===q(m.lc),'post-carry LC does not close');
  require(q(q(m.lc)+q(m.drift))===q(m.lr),'post-drift LR does not close');
}
// An interval uses one explicit row on both ends. Stored-gap mismatch is corrected
// only at the defined t1 landing, never by an invented initial correction.
function intervalPose(m:CollisionMotion,t:number,row:number,data:ReadonlySourceBiomeData):CollisionPose{
  if(m.kind==='static')return{x:q(m.x),z:q(m.z)};
  const z=lerp(m.z0,m.z1,t);
  if(m.kind==='traffic')return{x:q(q(lerp(m.offset0,m.offset1,t)*1600)+(m.side===1?data.segments[row]!.gap:0)),z};
  const startGap=data.segments[rowAt(m.z0,data)]!.gap;
  const reference=q(m.previousGap)===q(startGap)?q(m.previousGap):q(startGap);
  const carry=m.carryApplied?q(q(data.segments[row]!.gap-reference)/1600):0;
  const drift=t===0?0:t===1?q(m.drift):q(q(m.drift)*t);
  return{x:q(q(q(lerp(m.l0,m.ls,t)+carry)+drift)*1600),z};
}
/** Authoritative endpoints, or an unbounded continuous pose on the supplied row. */
export function collisionPose(m:CollisionMotion,t:number,row:number,data:ReadonlySourceBiomeData):CollisionPose{
  require(Number.isFinite(t)&&t>=0&&t<=1,'invalid pose time');
  if(m.kind==='player'&&t===1)return{x:q(q(m.lf)*1600),z:q(m.z1)};
  return intervalPose(m,t,row,data);
}
function events(m:CollisionMotion,actor:0|1,data:ReadonlySourceBiomeData):RowEvent[]{
  if(m.kind==='static')return[];
  const z0=q(m.z0),z1=q(m.z1),out:RowEvent[]=[],length=data.segmentLength;
  if(z1>z0){
    for(let row=rowAt(z0,data)+1;row*length<=z1;row++)out.push({num:row*length-z0,den:z1-z0,row,boundary:row*length,actor});
  }else if(z1<z0){
    for(let row=rowAt(z0,data);row*length>z1;row--){
      const boundary=row*length;
      if(boundary<=z0)out.push({num:z0-boundary,den:z0-z1,row:row-1,boundary,actor});
    }
  }
  // Every crossed source row is represented, including large/reverse pure fixtures.
  require(out.length<=data.segments.length,'row-event bound exceeded');return out;
}
function compare(a:RowEvent,b:RowEvent){return a.num*b.den-b.num*a.den;}
function overlap(a:CollisionPose,ah:CollisionHull,b:CollisionPose,bh:CollisionHull){
  return Math.abs(q(a.x-b.x))<=q(ah.halfWidth+bh.halfWidth)&&Math.abs(q(a.z-b.z))<=q(ah.halfLength+bh.halfLength);
}
export function collisionOverlaps(a:CollisionPose,ah:CollisionHull,b:CollisionPose,bh:CollisionHull):boolean{return overlap(a,ah,b,bh);}
function slab(a0:CollisionPose,a1:CollisionPose,ah:CollisionHull,b0:CollisionPose,b1:CollisionPose,bh:CollisionHull):number|null{
  let enter=0,exit=1;
  for(const [axis,half] of [['x',q(ah.halfWidth+bh.halfWidth)],['z',q(ah.halfLength+bh.halfLength)]] as const){
    const from=q(a0[axis]-b0[axis]),to=q(a1[axis]-b1[axis]),delta=q(to-from);
    if(delta===0){if(Math.abs(from)>half)return null;continue;}
    const u0=(-half-from)/delta,u1=(half-from)/delta;
    enter=Math.max(enter,Math.min(u0,u1));exit=Math.min(exit,Math.max(u0,u1));
    if(enter>exit)return null;
  }
  return enter<=1&&exit>=0?Math.max(0,enter):null;
}
function chord(a:CollisionPose,b:CollisionPose,t:number):CollisionPose{return{x:lerp(a.x,b.x,t),z:lerp(a.z,b.z,t)};}

/** Pair-local source-row sweep. Gap/carry/bounds jumps test endpoints only. */
export function sweptContact(a:CollisionMotion,ah:CollisionHull,b:CollisionMotion,bh:CollisionHull,data:ReadonlySourceBiomeData):CollisionWitness|null{
  if((a.kind!=='static'&&a.barrier)||(b.kind!=='static'&&b.barrier))return null;
  validate(a,data);validate(b,data);
  for(const h of [ah,bh])require(Number.isFinite(h.halfWidth)&&Number.isFinite(h.halfLength)&&h.halfWidth>=0&&h.halfLength>=0,'invalid hull');
  const expires=(m:CollisionMotion)=>m.kind==='traffic'&&m.disappears?m.activeUntil!:1;
  const stop=Math.min(expires(a),expires(b));
  const terminal=(a.kind==='traffic'&&a.disappears&&expires(a)===stop)||(b.kind==='traffic'&&b.disappears&&expires(b)===stop);
  const all=[...events(a,0,data),...events(b,1,data)].sort(compare);
  let ar=rowAt(endZ(a,false),data),br=rowAt(endZ(b,false),data),time=0;
  let best:CollisionWitness|null=null,bestTime=Infinity,startAZ:number|undefined,startBZ:number|undefined;
  const point=(ap:CollisionPose,bp:CollisionPose,t:number,stage:CollisionStage)=>{
    if(t<bestTime&&overlap(ap,ah,bp,bh)){bestTime=t;best={toi:q(t),stage,a:ap,b:bp};}
  };
  const interval=(until:number,atJump:boolean,endAZ?:number,endBZ?:number)=>{
    if(until<=time)return;
    let a0=intervalPose(a,time,ar,data),a1=intervalPose(a,until,ar,data);
    let b0=intervalPose(b,time,br,data),b1=intervalPose(b,until,br,data);
    if(startAZ!==undefined)a0={...a0,z:q(startAZ)};if(endAZ!==undefined)a1={...a1,z:q(endAZ)};
    if(startBZ!==undefined)b0={...b0,z:q(startBZ)};if(endBZ!==undefined)b1={...b1,z:q(endBZ)};
    const u=slab(a0,a1,ah,b0,b1,bh);
    if(u!==null){const t=time+(until-time)*u;if(t<bestTime){bestTime=t;best={toi:q(t),stage:u===1&&atJump?'pre-jump':'continuous',a:chord(a0,a1,u),b:chord(b0,b1,u)};}}
  };
  point(intervalPose(a,0,ar,data),intervalPose(b,0,br,data),0,'pre-jump');
  for(let i=0;i<all.length;){
    const event=all[i]!,t=event.num/event.den;
    if(t>stop)break;
    // Equal retained ratios form ONE atomic landing; equal rounded times alone do not.
    let j=i,endAZ:number|undefined,endBZ:number|undefined;
    while(j<all.length&&compare(event,all[j]!)===0){const e=all[j]!;if(e.actor===0)endAZ=e.boundary;else endBZ=e.boundary;j++;}
    interval(t,true,endAZ,endBZ);
    // A departing old lifetime includes this incoming endpoint, not a new-row
    // landing or player bound operation after it has ceased to exist.
    if(terminal&&t===stop)return best;
    for(let k=i;k<j;k++){const e=all[k]!;if(e.actor===0)ar=e.row;else br=e.row;}
    if(t<1){
      let ap=intervalPose(a,t,ar,data),bp=intervalPose(b,t,br,data);
      for(let k=i;k<j;k++){const e=all[k]!;if(e.actor===0)ap={...ap,z:q(e.boundary)};else bp={...bp,z:q(e.boundary)};}
      point(ap,bp,t,'post-jump');
    }
    time=t;startAZ=endAZ;startBZ=endBZ;i=j;
  }
  interval(stop,true);
  if(terminal||stop<1)return best;
  // Defined t1 order: incoming old rows -> atomic post-row raw LR -> final LF.
  // Never pair a new-gap player LR with an old-gap traffic pose.
  const raw=(m:CollisionMotion,row:number):CollisionPose=>m.kind==='player'?{x:q(q(m.lr)*1600),z:q(m.z1)}:intervalPose(m,1,row,data);
  const ap=raw(a,ar),bp=raw(b,br);point(ap,bp,1,'post-jump');
  const final=(m:CollisionMotion,row:number)=>collisionPose(m,1,row,data);
  point(final(a,ar),final(b,br),1,'final-bound');
  return best;
}
