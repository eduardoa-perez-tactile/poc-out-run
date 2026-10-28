// Synthetic renderer proof. No campaign graph or source-art import.
export const FORK_LENGTH=180000;
export const FORK_SPLIT_START=36000;
export const FORK_SPLIT_END=60000;
export const FORK_MAX_SEPARATION=9600;
const smooth=(t:number)=>t*t*(3-2*t);
export function forkSeparation(distance:number):number {
  const d=((distance%FORK_LENGTH)+FORK_LENGTH)%FORK_LENGTH;
  if(d>=150000)return FORK_MAX_SEPARATION*smooth((180000-d)/30000);
  return FORK_MAX_SEPARATION*smooth(Math.max(0,Math.min(1,(d-FORK_SPLIT_START)/(FORK_SPLIT_END-FORK_SPLIT_START))));
}
export function forkCenter(distance:number,side:number):number{return (side===0?-0.5:0.5)*forkSeparation(distance);}
// Keep the original integer-per-segment rule as an explicit conversion oracle.
export function sourceGapEndpoint(previous:number,target:number,segments:number):number {
  if(!Number.isInteger(segments)||segments<=0)throw new RangeError('gap expansion requires positive segment count');
  return previous+Math.trunc((target-previous)/segments)*segments;
}
// Exact configured Map1, Map2 and Map6 RGB; synthetic background shapes are not
// the source's panoramas. Linear interpolation is a deliberate presentation rule.
const linear=(v:number)=>Math.round(255*(v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4));
const rgb=(r:number,g:number,b:number)=>Object.freeze([linear(r),linear(g),linear(b)]);
export const FORK_PALETTES=Object.freeze([
  Object.freeze({sky:rgb(0,148,255),terrain:Object.freeze([rgb(230,214,197),rgb(239,222,206)]),road:Object.freeze([rgb(148,148,148),rgb(156,156,156)]),far:rgb(152,120,8),near:rgb(106,88,68)}),
  Object.freeze({sky:rgb(0,128,246),terrain:Object.freeze([rgb(132,188,27),rgb(163,218,60)]),road:Object.freeze([rgb(105,71,67),rgb(139,105,101)]),far:rgb(80,130,25),near:rgb(35,100,30)}),
  Object.freeze({sky:rgb(247,223,0),terrain:Object.freeze([rgb(230,158,0),rgb(213,135,0)]),road:Object.freeze([rgb(68,68,68),rgb(68,68,68)]),far:rgb(152,90,20),near:rgb(100,60,30)}),
]);
export const FORK_WHITE=rgb(247,247,247);
export const blendColor=(out:Uint8Array,a:ArrayLike<number>,b:ArrayLike<number>,p:number)=>{
  for(let i=0;i<3;i++)out[i]=Math.round(a[i]!+(b[i]!-a[i]!)*Math.max(0,Math.min(1,p)));
};
