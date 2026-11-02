import type {ReadonlySourceBiomeData} from '../schema.gen.ts';
import {sampleRouteZ} from './route-space.ts';

/** Optional domain only. Legacy proof traffic never acquires these identities. */
export interface TrafficRouteDomain {readonly kind:'source-route';readonly routeEpoch:number;readonly mapEpoch:number;}
export function validateTrafficRouteDomain(value:TrafficRouteDomain):void {
  if(value.kind!=='source-route'||![value.routeEpoch,value.mapEpoch].every(n=>Number.isInteger(n)&&n>0&&n<=0xffffffff))throw new Error('Invalid traffic route identity');
}
export function routeTrafficInteger(value:number):number {
  if(typeof value!=='number'||!Number.isInteger(value)||value< -0x80000000||value>0x7fffffff)throw new Error('Route traffic int32 overflow or invalid integer');
  return value;
}
/** Recycling is INTEGER addition, unlike float-expression movement assignment. */
export function addRouteTrafficZ(rawZ:number,distance:number):number {
  routeTrafficInteger(rawZ);routeTrafficInteger(distance);
  const z=routeTrafficInteger(rawZ+distance);if(z<0)throw new Error('Negative route traffic spawn/recycle Z');return z;
}
interface Knot {n:number;d:number;actor:0|1;change:1|-1;}
function compare(a:Knot,b:Knot):number{return a.n*b.d-b.n*a.d;}

/** A pass exists only inside a continuous canonical interval. Each actor's own
 * lap may differ from the other's. Split their wrap jumps; never award the jump
 * alone, and do not blanket-discard a genuine pass before or after a wrap. */
export function routeCanonicalOvertake(data:ReadonlySourceBiomeData,car0:number,car1:number,player0:number,player1:number):boolean {
  const car=sampleRouteZ(data,car0),player=sampleRouteZ(data,player0);sampleRouteZ(data,car1);sampleRouteZ(data,player1);
  const length=data.totalCount*data.segmentLength,delta=[car1-car0,player1-player0],start=[car0,player0],end=[car1,player1];
  if(delta.some(n=>Math.abs(n)>length))throw new Error('Route traffic pass interval exceeds one source lap');
  const knots:Knot[]=[];
  for(const actor of [0,1]as const){
    const dz=delta[actor]!,z0=start[actor]!,z1=end[actor]!;
    if(dz>0){for(let boundary=(Math.floor(z0/length)+1)*length;boundary<=z1;boundary+=length)knots.push({n:boundary-z0,d:dz,actor,change:1});}
    else if(dz<0){for(let boundary=Math.floor(z0/length)*length;boundary>=z1&&boundary>=0;boundary-=length)knots.push({n:z0-boundary,d:-dz,actor,change:-1});}
  }
  knots.sort(compare);const laps=[car.lap,player.lap];let previous={n:0,d:1},index=0;
  function relative(time:{n:number;d:number}):number {
    const base=(car0-laps[0]!*length)-(player0-laps[1]!*length);
    // Exact integer numerator comparisons, bounded by the one-lap deltas.
    return base*time.d+(delta[0]!-delta[1]!)*time.n;
  }
  while(index<knots.length){
    const next=knots[index]!;
    if(next.n*previous.d>previous.n*next.d&&relative(previous)>=0&&relative(next)<0)return true;
    while(index<knots.length&&compare(knots[index]!,next)===0){const knot=knots[index++]!;laps[knot.actor]=laps[knot.actor]!+knot.change;}
    previous={n:next.n,d:next.d};
  }
  return previous.n<previous.d&&relative(previous)>=0&&relative({n:1,d:1})<0;
}
