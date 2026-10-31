import {worldTest,expect} from '@gameengine/test';
import {resetCrashRecovery,beginCrashRecovery,resetRouteCrashRecovery,beginRouteCrashRecovery,finishCrashRecoveryAtCamera} from '../../src/sim/crash-recovery-math.ts';
import {originalRouteSources} from '../../src/content/route-boot.ts';
import {resetTerrainDriver} from '../../src/sim/terrain-math.ts';

worldTest('routes.crash physical acceptance starts the same exact phase on every ordinary destination',()=>{
  for(let mapId=1;mapId<=15;mapId++){
    const initial=resetRouteCrashRecovery(mapId),contact={mapId,kind:2,impactSpeed:100,handlingCap:200,collisionDir:.5,curve:0};
    const crash=beginRouteCrashRecovery(initial,contact,1,1);
    expect(crash.mapId).toBe(mapId);expect(crash.phase).toBe(1);expect(crash.totalAdvances).toBe(24);
    expect(crash.consumedAcceptedCount).toBe(1);expect(crash.variant).toBe(1);expect(crash.advances).toBe(0);
    expect(()=>beginRouteCrashRecovery(initial,{...contact,mapId:mapId===15?1:mapId+1},1,1)).toThrow();
    expect(()=>beginRouteCrashRecovery(initial,contact,1,2)).toThrow();
  }
});
worldTest('routes.crash goal entry can preserve ongoing recovery but cannot begin a new collision',()=>{
  const data=originalRouteSources().get(16,1),crash={...beginRouteCrashRecovery(resetRouteCrashRecovery(15),
    {mapId:15,kind:1,impactSpeed:100,handlingCap:200,collisionDir:.5,curve:2},0,1),mapId:16};
  const terrain={...resetTerrainDriver(),mapId:16,initialized:true,previousGap:data.segments[4]!.gap};
  const next=finishCrashRecoveryAtCamera(crash,{distance:0,lateral:.5,legacySpeed:100,gear:1,steering:0,playing:true,manual:false},
    terrain,data,Math.fround(1/60),0,0);
  expect(next.crash.mapId).toBe(16);expect(next.crash.phase).toBe(1);expect(next.crash.cadenceTick).toBe(1);
  expect(next.crash.consumedAcceptedCount).toBe(1);expect(next.driving.distance).toBe(0);
  expect(()=>beginRouteCrashRecovery(resetRouteCrashRecovery(16),{mapId:16,kind:1,impactSpeed:100,handlingCap:200,collisionDir:0,curve:0},0,1)).toThrow();
});
worldTest('routes.crash legacy proof entry points still reject unsupported maps',()=>{
  expect(()=>resetCrashRecovery(2)).toThrow();
  expect(()=>beginCrashRecovery(resetRouteCrashRecovery(2),{mapId:2,kind:1,impactSpeed:100,handlingCap:200,collisionDir:0,curve:0},0,1)).toThrow();
  expect(()=>resetRouteCrashRecovery(0)).toThrow();expect(()=>resetRouteCrashRecovery(17)).toThrow();
});
