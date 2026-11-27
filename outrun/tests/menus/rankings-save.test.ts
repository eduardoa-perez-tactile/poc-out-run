import {worldTest,expect} from '@gameengine/test';
import {RankingStore,RANKINGS_SAVE_KEY,type RankingStorage} from '../../src/content/rankings.ts';
const bucket={mode:0,difficulty:1,population:20};
const entry={score:100,name:'AAA',totalTicks:12345};

worldTest('save.rankings preserves original presets, equal-score order and separate configuration tables',()=>{
  const memory:RankingStorage={get:()=>null,set:()=>{}};
  const store=new RankingStore(memory);
  expect(store.rows(bucket).map(row=>row.score)).toEqual([70,60,50,40,30,20,10]);
  expect(store.rows({...bucket,mode:1})[0]!.score).toBe(90028512);
  expect(store.rows(bucket)[2]!.totalCentiseconds).toBe(41229);
  expect(store.qualify(bucket,70)).toBe(1);expect(store.qualify(bucket,10)).toBe(-1);
  expect(store.submit(bucket,entry,'session1:race1')).toBe(true);
  expect(store.submit(bucket,{...entry,name:'BBB'},'session1:race2')).toBe(true);
  expect(store.rows(bucket).slice(0,2).map(row=>row.name)).toEqual(['AAA','BBB']);
  expect(store.rows(bucket).length).toBe(7);
  for(const other of [{...bucket,mode:2},{...bucket,difficulty:0},{...bucket,population:9}])expect(store.rows(other)[0]!.score).toBe(70);
});

worldTest('save.rankings round-trips versioned scores and rejects duplicate submissions after reopen',()=>{
  let saved:unknown=null;
  const storage:RankingStorage={get:()=>saved,set:(key,value)=>{expect(key).toBe(RANKINGS_SAVE_KEY);saved=value;}};
  const first=new RankingStore(storage);
  expect(first.submit(bucket,entry,'app-one:1')).toBe(true);
  expect(first.submit(bucket,entry,'app-one:1')).toBe(false);
  const reopened=new RankingStore(storage);
  expect(reopened.rows(bucket)[0]).toEqual(entry);
  expect(reopened.submit(bucket,entry,'app-one:1')).toBe(false);
  expect(reopened.submit(bucket,entry,'app-two:1')).toBe(true);
  expect(reopened.rows(bucket).filter(row=>row.score===100).length).toBe(2);
});

worldTest('save.rankings corrupt or unsupported saves recover defaults and denied storage retains session scores',()=>{
  for(const saved of ['{',null,{version:99,tables:{},submissions:[]},
    {version:1,tables:{'0:1:20':[{score:-1,name:'BAD',totalTicks:0}]},submissions:[]},
    {version:1,tables:{'0:1:20':[{score:1,name:'BAD',totalTicks:0},{score:2,name:'BAD',totalTicks:0}]},submissions:[]}]){
    const recovered=new RankingStore({get:()=>saved,set:()=>{}});
    expect(recovered.rows(bucket)[0]!.score).toBe(70);
  }
  const denied=new RankingStore({get(){throw new Error('denied');},set(){throw new Error('denied');}});
  expect(denied.storageUnavailable).toBe(true);
  expect(denied.submit(bucket,entry,'denied-app:1')).toBe(true);
  expect(denied.rows(bucket)[0]).toEqual(entry);
  expect(denied.submit(bucket,entry,'denied-app:1')).toBe(false);
  expect(denied.storageWarning.length>0).toBe(true);
  expect(denied.submit(bucket,{...entry,name:'A__'},'denied-app:2')).toBe(false);
});
