import {MAP02_ART} from './map02.manifest.ts';
import {MAP03_ART} from './map03.manifest.ts';
import {MAP04_ART} from './map04.manifest.ts';
import {MAP05_ART} from './map05.manifest.ts';
import {MAP06_ART} from './map06.manifest.ts';
import {MAP07_ART} from './map07.manifest.ts';
import {MAP08_ART} from './map08.manifest.ts';
import {MAP09_ART} from './map09.manifest.ts';
import {MAP10_ART} from './map10.manifest.ts';
import {MAP11_ART} from './map11.manifest.ts';
import {MAP12_ART} from './map12.manifest.ts';
import {MAP13_ART} from './map13.manifest.ts';
import {MAP14_ART} from './map14.manifest.ts';
import {MAP15_ART} from './map15.manifest.ts';
import {GOAL_ART} from './goal.manifest.ts';
import type {DestinationEnvironmentId,EnvironmentArtManifest} from './environment-art.ts';

export const DESTINATION_ENVIRONMENT_IDS=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16] as const;
const manifests:Readonly<Record<DestinationEnvironmentId,EnvironmentArtManifest>>={
  2:MAP02_ART,
  3:MAP03_ART,
  4:MAP04_ART,
  5:MAP05_ART,
  6:MAP06_ART,
  7:MAP07_ART,
  8:MAP08_ART,
  9:MAP09_ART,
  10:MAP10_ART,
  11:MAP11_ART,
  12:MAP12_ART,
  13:MAP13_ART,
  14:MAP14_ART,
  15:MAP15_ART,
  16:GOAL_ART,
};
export function destinationEnvironment(mapId:number):EnvironmentArtManifest {
  if(typeof mapId!=='number'||!Number.isInteger(mapId)||mapId<2||mapId>16)throw new Error(`Unsupported destination environment ${mapId}`);
  return manifests[mapId as DestinationEnvironmentId];
}
export function destinationDataGroup(mapId:number):string {
  destinationEnvironment(mapId);
  return mapId===16?'biome-goal-data':`biome-map${String(mapId).padStart(2,'0')}-data`;
}
