import type {SourceBiomeId} from '../biome.ts';

export type DestinationEnvironmentId=Exclude<SourceBiomeId,1>;
export interface SourcePixelProbe {
  readonly kind:'opaque'|'alpha'|'transparent';
  readonly pixelPx:readonly [number,number];
  readonly rgba:readonly [number,number,number,number];
}
export interface EnvironmentAtlasPage {
  readonly image:string;
  readonly sizePx:readonly [number,number];
  readonly extrudePx:2;
  readonly sha256:string;
}
export interface EnvironmentAtlasImage {
  readonly objectId:number;
  readonly sourcePath:string;
  /** Original input key, excluded from runtime texture groups. */
  readonly image:string;
  readonly sourceSizePx:readonly [number,number];
  readonly sha256:string;
  readonly page:0|1;
  readonly atlasRectPx:readonly [number,number,number,number];
  readonly sourceProbe:SourcePixelProbe;
}
export interface EnvironmentPanorama {
  readonly sourcePath:string;
  readonly image:string;
  readonly sizePx:readonly [number,number];
  readonly sha256:string;
  readonly sourceProbe:SourcePixelProbe;
}
/** Image/packing metadata only. SourceBiome owns geometry and visual/collision pivots. */
export interface EnvironmentArtManifest {
  readonly assetId:string;
  readonly mapId:DestinationEnvironmentId;
  readonly sourceCommit:string;
  readonly pages:readonly EnvironmentAtlasPage[];
  readonly images:readonly EnvironmentAtlasImage[];
  readonly back:EnvironmentPanorama;
  readonly front:EnvironmentPanorama;
}
