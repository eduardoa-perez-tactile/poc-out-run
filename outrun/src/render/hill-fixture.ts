// Immutable synthetic renderer fixtures, not source track conversion or AI traffic.
export const HILL_START = 30000;
export const HILL_SPAN = 36000;
export const HILL_HEIGHT = 4200;
export function hillHeight(distance: number): number {
  const d = ((distance % 180000) + 180000) % 180000;
  // Separate positive crest and negative valley; both return smoothly to zero.
  if (d >= HILL_START && d <= HILL_START + HILL_SPAN)
    return HILL_HEIGHT * (1 - Math.cos((d - HILL_START) / HILL_SPAN * Math.PI * 2)) / 2;
  if (d > 108000 && d < 144000)
    return -3000 * (1 - Math.cos((d - 108000) / 36000 * Math.PI * 2)) / 2;
  return 0;
}
export interface ProofObject {
  readonly id: number; readonly distance: number; readonly lateral: number;
  readonly width: number; readonly height: number; readonly cell: number;
  readonly pivotX: number; readonly pivotY: number;
}
export const OBJECT_CAPACITY = 64;
export const HILL_OBJECTS: readonly ProofObject[] = Object.freeze(Array.from({ length: OBJECT_CAPACITY }, (_, id) => {
  const pair = Math.floor(id / 2);
  return Object.freeze({ id, distance: 39000 + pair * 720, lateral: id % 6 === 0 ? -0.35 : id % 3 === 0 ? -0.25 : id % 2 ? 1.45 : -1.45,
    width: 950, height: 1900, cell: id % 6 === 0 ? 2 : id % 3 === 0 ? 1 : 0, pivotX: 0.5, pivotY: 1 });
}));
