/** Local presentation data; ranking saves never participate in race simulation.
 * Rules/presets: source6882721 Score.cpp and Resources/Score/{mode}/scores*.txt.
 */
export interface RankingBucket {mode:number;difficulty:number;population:number;}
export interface RankingEntry {score:number;name:string;totalTicks:number;totalCentiseconds?:number;}
export interface RankingStorage {get(key:string,fallback:unknown):unknown;set(key:string,value:unknown):void;}
export const RANKINGS_SAVE_KEY='outrun.rankings.v1';
export const RANKING_LIMIT=7;
const RECEIPT_LIMIT=128;
interface RankingSave {version:1;tables:Record<string,RankingEntry[]>;submissions:string[];}
const defaults:readonly (readonly [number,string,number,number,number])[]=[
  [70,'ZGZ',5,13,10],[60,'SUB',5,43,18],[50,'ADD',6,52,29],[40,'SER',6,25,44],
  [30,'GOG',6,37,53],[20,'CAT',7,19,31],[10,'RMF',7,42,49],
];
function bucketValid(bucket:RankingBucket):boolean {
  return [0,1,2].includes(bucket.mode)&&[0,1,2].includes(bucket.difficulty)&&[9,20,32].includes(bucket.population);
}
export function rankingBucketKey(bucket:RankingBucket):string {
  if(!bucketValid(bucket))throw new Error('Invalid ranking bucket');
  return `${bucket.mode}:${bucket.difficulty}:${bucket.population}`;
}
function sourceEntry(row:readonly [number,string,number,number,number]):RankingEntry {
  const [score,name,minutes,seconds,centiseconds]=row,totalCentiseconds=(minutes*60+seconds)*100+centiseconds;
  return {score,name,totalTicks:Math.ceil(totalCentiseconds*60/100),totalCentiseconds};
}
function sourceTables():Record<string,RankingEntry[]> {
  const tables:Record<string,RankingEntry[]>={};
  for(const mode of [0,1,2])for(const difficulty of [0,1,2])for(const population of [9,20,32]){
    const rows=defaults.map(sourceEntry);
    if(mode===1&&difficulty===1&&population===20){rows.unshift(sourceEntry([90028512,'ZGZ',22,12,0]));rows.length=RANKING_LIMIT;}
    tables[rankingBucketKey({mode,difficulty,population})]=rows;
  }
  return tables;
}
function object(value:unknown):value is Record<string,unknown> {return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function natural(value:unknown):value is number {return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function validEntry(value:unknown):value is RankingEntry {
  return object(value)&&natural(value.score)&&typeof value.name==='string'&&/^[A-Z]{3}$/.test(value.name)&&natural(value.totalTicks)&&
    (value.totalCentiseconds===undefined||natural(value.totalCentiseconds));
}
function copyEntry(value:RankingEntry):RankingEntry {
  return {score:value.score,name:value.name,totalTicks:value.totalTicks,
    ...(value.totalCentiseconds===undefined?{}:{totalCentiseconds:value.totalCentiseconds})};
}
function readSave(value:unknown):RankingSave|null {
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
  if(!object(value)||value.version!==1||!object(value.tables)||!Array.isArray(value.submissions)||
    value.submissions.length>RECEIPT_LIMIT||!value.submissions.every(id=>typeof id==='string'&&id.length>0&&id.length<=200))return null;
  const tables=sourceTables();
  for(const [key,rows]of Object.entries(value.tables)){
    if(!Object.hasOwn(tables,key)||!Array.isArray(rows)||rows.length>RANKING_LIMIT||!rows.every(validEntry))return null;
    if(rows.some((row,index)=>index>0&&rows[index-1]!.score<row.score))return null;
    tables[key]=rows.map(copyEntry);
  }
  return {version:1,tables,submissions:[...value.submissions] as string[]};
}
/** Per-app owner. Duplicate submission IDs must identify an individual attempt,
 * including a fresh app-session identity, rather than a reusable raceEpoch alone.
 */
export class RankingStore {
  private tables=sourceTables();
  private submissions=new Set<string>();
  private unavailable=false;
  constructor(private storage:RankingStorage){
    try{
      const saved=readSave(storage.get(RANKINGS_SAVE_KEY,null));
      if(saved){this.tables=saved.tables;this.submissions=new Set(saved.submissions);}
    }catch{this.unavailable=true;}
  }
  get storageUnavailable():boolean {return this.unavailable;}
  get storageWarning():string {return this.unavailable?'STORAGE UNAVAILABLE · SCORES KEPT FOR THIS SESSION':'';}
  rows(bucket:RankingBucket):readonly Readonly<RankingEntry>[] {
    return Object.freeze(this.tables[rankingBucketKey(bucket)]!.map(row=>Object.freeze(copyEntry(row))));
  }
  qualify(bucket:RankingBucket,score:number):number {
    if(!natural(score))return -1;
    const rows=this.tables[rankingBucketKey(bucket)]!;
    const rank=rows.findIndex(row=>row.score<score);
    return rank>=0?rank:rows.length<RANKING_LIMIT?rows.length:-1;
  }
  submit(bucket:RankingBucket,entry:RankingEntry,submissionId:string):boolean {
    if(typeof submissionId!=='string'||submissionId.length===0||submissionId.length>200||this.submissions.has(submissionId)||!validEntry(entry))return false;
    const rank=this.qualify(bucket,entry.score);if(rank<0)return false;
    const key=rankingBucketKey(bucket),rows=this.tables[key]!.slice();
    rows.splice(rank,0,copyEntry(entry));rows.length=Math.min(rows.length,RANKING_LIMIT);this.tables[key]=rows;
    this.submissions.add(submissionId);
    const save:RankingSave={version:1,tables:this.tables,submissions:[...this.submissions].slice(-RECEIPT_LIMIT)};
    // Session rows/receipts already changed. Storage denial never blocks the UI
    // or causes a second click to insert a duplicate record.
    try{this.storage.set(RANKINGS_SAVE_KEY,JSON.parse(JSON.stringify(save)));this.unavailable=false;}
    catch{this.unavailable=true;}
    return true;
  }
}
