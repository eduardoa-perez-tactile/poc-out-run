import {expect} from '@gameengine/test';
import {assets} from '@gameengine/runtime';

/** An unpinned group may keep its cache or already have been evicted. */
export function expectReleasedGroup(name:string):void {
  const group=assets.stats().groups[name]!;
  expect(group.status==='released'||group.status==='unloaded').toBe(true);
  // SDK0.1.34 settles a released group to unloaded once no resident member
  // remains. An unloaded label alone must never hide a retained allocation.
  if(group.status==='unloaded'){
    expect(group.resident.textures).toBe(0);expect(group.resident.audio).toBe(0);
  }
}
