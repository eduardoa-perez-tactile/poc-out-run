import {RankingStore,type RankingBucket,type RankingEntry} from '../content/rankings.ts';
import type {RankingsModel} from '../views/rankings.view.tsx';

export interface RankingCandidate {score:number;totalTicks:number;submissionId:string;}
export function rankingTime(entry:Pick<RankingEntry,'totalTicks'|'totalCentiseconds'>):string {
  const cs=entry.totalCentiseconds??Math.floor(entry.totalTicks*100/60);
  return `${String(Math.floor(cs/6000)).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;
}
/** Presentation-only name entry: the source28-second deadline never affects a race. */
export class RankingsFlow {
  private bucket:RankingBucket;
  private draft='';
  private letter=0;
  private entry=false;
  private deadline:number|null;
  private seconds=28;
  private status='';
  private closed=false;
  constructor(private store:RankingStore,bucket:RankingBucket,private candidate:RankingCandidate|undefined,
    nowMs:number,private onClose:()=>void){
    this.bucket={...bucket};this.entry=!!candidate&&store.qualify(bucket,candidate.score)>=0;
    this.deadline=candidate?nowMs+28000:null;
  }
  get isOpen():boolean{return !this.closed;}
  model():RankingsModel {
    const rows=this.store.rows(this.bucket).map(row=>({...row}));
    if(this.entry&&this.candidate){
      const rank=this.store.qualify(this.bucket,this.candidate.score);
      if(rank>=0)rows.splice(rank,0,{score:this.candidate.score,name:this.draft.padEnd(3,'_'),totalTicks:this.candidate.totalTicks});
    }
    const mode=['ORIGINAL','CONTINUOUS','SURVIVAL'][this.bucket.mode],difficulty=['EASY','NORMAL','HARD'][this.bucket.difficulty];
    const traffic=this.bucket.population===9?'LOW':this.bucket.population===32?'HIGH':'MEDIUM';
    return {subtitle:`${mode} · ${difficulty} · ${traffic} TRAFFIC`,
      rows:rows.slice(0,7).map((row,index)=>({rank:String(index+1),score:String(row.score),name:row.name,time:rankingTime(row)})),
      draft:`${this.draft.padEnd(3,'_')}   ·   ${String.fromCharCode(65+this.letter)}`,
      entry:this.entry,countdown:this.deadline===null?'':String(this.seconds),
      status:this.status||this.store.storageWarning||(this.entry?'NEW RECORD · ENTER THREE LETTERS':this.candidate?'PRESS CONTINUE':'LOCAL RANKINGS')};
  }
  tick(nowMs:number):boolean {
    if(this.closed||this.deadline===null)return false;
    const seconds=Math.max(0,Math.ceil((this.deadline-nowMs)/1000));
    if(seconds===0){this.close();return false;}
    if(seconds===this.seconds)return false;
    this.seconds=seconds;return true;
  }
  input(action:string):void {
    if(this.closed)return;
    if(action==='close'){this.close();return;}
    if(action==='confirm'){
      if(!this.entry){this.close();return;}
      if(this.draft.length!==3){this.status='ENTER THREE LETTERS';return;}
      const saved=this.store.submit(this.bucket,{score:this.candidate!.score,name:this.draft,totalTicks:this.candidate!.totalTicks},this.candidate!.submissionId);
      this.entry=false;
      if(saved&&this.store.storageUnavailable){this.deadline=null;this.status=this.store.storageWarning;return;}
      this.close();return;
    }
    if(this.entry){
      this.status='';
      if(action==='previousLetter')this.letter=(this.letter+25)%26;
      else if(action==='nextLetter')this.letter=(this.letter+1)%26;
      else if(action==='erase')this.draft=this.draft.slice(0,-1);
      else if(action==='addLetter'&&this.draft.length<3)this.draft+=String.fromCharCode(65+this.letter);
      else if(/^[A-Z]$/.test(action)&&this.draft.length<3)this.draft+=action;
    }else if(!this.candidate){
      if(action==='nextMode')this.bucket.mode=(this.bucket.mode+1)%3;
      else if(action==='nextDifficulty')this.bucket.difficulty=(this.bucket.difficulty+1)%3;
      else if(action==='nextTraffic')this.bucket.population=[9,20,32][([9,20,32].indexOf(this.bucket.population)+1)%3]!;
    }
  }
  private close():void {if(this.closed)return;this.closed=true;this.onClose();}
}
