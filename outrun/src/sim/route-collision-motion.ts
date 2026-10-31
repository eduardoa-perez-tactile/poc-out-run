import {math} from '@gameengine/runtime';
import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import {sampleRouteZ} from './route-space.ts';
import {collisionSlab,collisionOverlaps,type CollisionMotion,type CollisionHull,type CollisionPose,type CollisionWitness,type CollisionStage} from './collision-motion.ts';

const q=math.fround;
interface Knot {num:number;den:number;absoluteRow:number;actor:0|1}
function need(value:boolean,message:string):asserts value{if(!value)throw new Error('Route collision: '+message);}
function z(m:CollisionMotion,end:boolean){return m.kind==='static'?m.z:end?m.z1:m.z0;}
function lerp(a:number,b:number,t:number){return t===0?q(a):t===1?q(b):q(q(a)+q(q(b-a)*t));}
function order(a:Knot,b:Knot){return a.num*b.den-b.num*a.den;}
function row(absoluteRow:number,data:ReadonlySourceBiomeData){return absoluteRow%data.totalCount;}
function validate(m:CollisionMotion,data:ReadonlySourceBiomeData){
  sampleRouteZ(data,z(m,false));sampleRouteZ(data,z(m,true));
  need(Math.abs(z(m,true)-z(m,false))<=data.totalCount*150,'motion exceeds one full source length');
  if(m.kind==='player'){
    need([m.l0,m.ls,m.lc,m.lr,m.lf,m.drift,m.previousGap].every(Number.isFinite),'nonfinite player operands');
    const gap=data.segments[sampleRouteZ(data,m.z1).row]!.gap;
    const carry=m.carryApplied?q(q(gap-q(m.previousGap))/1600):0;
    need(q(q(m.ls)+carry)===q(m.lc)&&q(q(m.lc)+q(m.drift))===q(m.lr),'player stages do not close');
  }else if(m.kind==='traffic'){
    need([m.offset0,m.offset1].every(Number.isFinite)&&(m.side===0||m.side===1),'invalid traffic pose');
    need(!m.disappears&&m.activeUntil===undefined,'route old life must be queried before replacement');
  }else need(Number.isFinite(m.x)&&m.z<data.totalCount*150,'invalid canonical roadside pose');
}
function knots(m:CollisionMotion,actor:0|1,data:ReadonlySourceBiomeData):Knot[]{
  if(m.kind==='static')return[];
  const start=m.z0,end=m.z1,out:Knot[]=[];
  if(end>start){
    for(let r=Math.floor(start/150)+1;r*150<=end;r++)out.push({num:r*150-start,den:end-start,absoluteRow:r,actor});
  }else if(end<start){
    for(let r=Math.floor(start/150);r*150>end;r--)out.push({num:start-r*150,den:start-end,absoluteRow:r-1,actor});
  }
  need(out.length<=data.totalCount+1,'source row knot bound exceeded');return out;
}
/** Explicit absolute row supplies the incoming OR outgoing side of a wrap.
 * Subtract its lap BEFORE f32 conversion, preserving odd raw int32 positions. */
function pose(m:CollisionMotion,t:number,absoluteRow:number,data:ReadonlySourceBiomeData):CollisionPose{
  if(m.kind==='static')return{x:q(m.x),z:m.z};
  const lap=Math.floor(absoluteRow/data.totalCount),currentRow=row(absoluteRow,data);
  const start=m.z0-lap*data.totalCount*150;
  const canonicalZ=t===0?start:t===1?m.z1-lap*data.totalCount*150:q(start+q((m.z1-m.z0)*t));
  if(m.kind==='traffic')return{x:q(q(lerp(m.offset0,m.offset1,t)*1600)+(m.side===1?data.segments[currentRow]!.gap:0)),z:canonicalZ};
  const startGap=data.segments[sampleRouteZ(data,m.z0).row]!.gap;
  const reference=q(m.previousGap)===q(startGap)?q(m.previousGap):q(startGap);
  const carry=m.carryApplied?q(q(data.segments[currentRow]!.gap-reference)/1600):0;
  const drift=t===0?0:t===1?q(m.drift):q(q(m.drift)*t);
  return{x:q(q(q(lerp(m.l0,m.ls,t)+carry)+drift)*1600),z:canonicalZ};
}
export function routeCollisionPose(m:CollisionMotion,end:boolean,data:ReadonlySourceBiomeData):CollisionPose{
  validate(m,data);const r=sampleRouteZ(data,z(m,end)).absoluteRow;
  if(end&&m.kind==='player')return{x:q(m.lf*1600),z:sampleRouteZ(data,m.z1).canonicalZ};
  return pose(m,end?1:0,r,data);
}
/** Same physical slab kernel as legacy CCD; source aliases share canonical Z.
 * At each row/wrap: closed incoming interval, then BOTH actors land atomically.
 * No segment joins fullLength to zero; a wrap alone cannot sweep the road.
 */
export function sweptRouteContact(a:CollisionMotion,ah:CollisionHull,b:CollisionMotion,bh:CollisionHull,data:ReadonlySourceBiomeData):CollisionWitness|null{
  validate(a,data);validate(b,data);
  for(const h of [ah,bh])need(Number.isFinite(h.halfWidth)&&Number.isFinite(h.halfLength)&&h.halfWidth>=0&&h.halfLength>=0,'invalid hull');
  if((a.kind!=='static'&&a.barrier)||(b.kind!=='static'&&b.barrier))return null;
  let ar=sampleRouteZ(data,z(a,false)).absoluteRow,br=sampleRouteZ(data,z(b,false)).absoluteRow,time=0;
  const events=[...knots(a,0,data),...knots(b,1,data)].sort(order);
  let best:CollisionWitness|null=null,bestTime=Infinity;
  const point=(ap:CollisionPose,bp:CollisionPose,t:number,stage:CollisionStage)=>{
    if(t<bestTime&&collisionOverlaps(ap,ah,bp,bh)){bestTime=t;best={toi:q(t),stage,a:ap,b:bp};}
  };
  const interval=(until:number,jump:boolean)=>{
    if(until<=time)return;
    const a0=pose(a,time,ar,data),a1=pose(a,until,ar,data),b0=pose(b,time,br,data),b1=pose(b,until,br,data);
    const u=collisionSlab(a0,a1,ah,b0,b1,bh);if(u===null)return;
    const t=time+(until-time)*u;
    if(t<bestTime){bestTime=t;best={toi:q(t),stage:u===1&&jump?'pre-jump':'continuous',
      a:{x:lerp(a0.x,a1.x,u),z:lerp(a0.z,a1.z,u)},b:{x:lerp(b0.x,b1.x,u),z:lerp(b0.z,b1.z,u)}};}
  };
  point(pose(a,0,ar,data),pose(b,0,br,data),0,'pre-jump');
  for(let i=0;i<events.length;){
    const event=events[i]!,t=event.num/event.den;let j=i+1;
    while(j<events.length&&order(event,events[j]!)===0)j++;
    interval(t,true);
    for(let k=i;k<j;k++){const e=events[k]!;if(e.actor===0)ar=e.absoluteRow;else br=e.absoluteRow;}
    if(t<1)point(pose(a,t,ar,data),pose(b,t,br,data),t,'post-jump');
    time=t;i=j;
  }
  interval(1,true);
  const raw=(m:CollisionMotion,r:number)=>m.kind==='player'?{x:q(m.lr*1600),z:sampleRouteZ(data,m.z1).canonicalZ}:pose(m,1,r,data);
  point(raw(a,ar),raw(b,br),1,'post-jump');
  point(routeCollisionPose(a,true,data),routeCollisionPose(b,true,data),1,'final-bound');
  return best;
}
