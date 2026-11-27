import {assets} from '@gameengine/runtime';

/** Restore released-cache eligibility lost by SDK0.1.34's between-test reset. */
export function releaseTestCache():void {
  const stats=assets.stats();
  for(const row of assets.resident()){
    // The shared T1 renderer keeps these allocations while the test reset marks
    // all their owners unloaded. Never touch active, unknown or ungrouped owners.
    const forgotten=row.groups.length>0&&row.groups.every(name=>{
      // SDK asset_set_name prefixes direct-key owners with exactly "asset:";
      // public stats expose those owners separately under assets[key].
      const owner=stats.groups[name]??(name.startsWith('asset:')?stats.assets[name.slice(6)]:undefined);
      return owner?.status==='unloaded';
    });
    if(!forgotten)continue;
    // This key is already resident: register and immediately release only its
    // direct-key ownership. Do not load group siblings or unpin any live group.
    const selection={assets:[row.key]};
    assets.load(selection);assets.release(selection);
  }
}
