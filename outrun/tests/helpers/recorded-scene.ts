import scene0 from '../../scenes/map01-data.scene.json';
import scene1 from '../../scenes/original-route-sim.scene.json';
import scene2 from '../../scenes/original-race.scene.json';
import scene3 from '../../scenes/driving-crash.scene.json';
import scene4 from '../../scenes/driving-contact.scene.json';
import scene5 from '../../scenes/driving-traffic.scene.json';
import scene6 from '../../scenes/driving-terrain.scene.json';
import scene7 from '../../scenes/destination-environment.scene.json';
import scene8 from '../../scenes/map01-art.scene.json';
import scene9 from '../../scenes/road-proof.scene.json';
import scene10 from '../../scenes/vehicle-preview.scene.json';

// Read identity from the authored documents: never copy a GUID or depend on a
// world asset slot having been interned before its first recorded scene entry.
const SCENES:Readonly<Record<string,string>>={
  'scenes/map01-data.scene.json':scene0.guid,
  'scenes/original-route-sim.scene.json':scene1.guid,
  'scenes/original-race.scene.json':scene2.guid,
  'scenes/driving-crash.scene.json':scene3.guid,
  'scenes/driving-contact.scene.json':scene4.guid,
  'scenes/driving-traffic.scene.json':scene5.guid,
  'scenes/driving-terrain.scene.json':scene6.guid,
  'scenes/destination-environment.scene.json':scene7.guid,
  'scenes/map01-art.scene.json':scene8.guid,
  'scenes/road-proof.scene.json':scene9.guid,
  'scenes/vehicle-preview.scene.json':scene10.guid,
};
/** SDK0.1.34 records scene identity as its stable authored GUID. */
export function recordedScene(path:string):string {
  const guid=SCENES[path];
  if(!guid||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid))throw new Error(`Recorded scene has no stable GUID: ${path}`);
  return guid;
}
