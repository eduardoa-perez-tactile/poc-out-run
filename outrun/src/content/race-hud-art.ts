// Original HUD art from pinned source 6882721c99bc79365f815f68d389bf5078129e68.
export function routeTreeArt(mapId:number):string {
  return `textures/hud/route-${Math.max(1,Math.min(15,Math.trunc(mapId)))}`;
}
