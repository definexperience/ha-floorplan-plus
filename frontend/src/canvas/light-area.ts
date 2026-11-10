/** How a light's lit area is filled while the light is on. "solid" tints
 * the whole room or shape evenly. "fade" is brightest at the light's marker
 * and fades out towards the area's far edge, staying inside the area. */

/** How far the fade reaches: from the marker to the area's farthest
 * corner, so the whole area gets some light and the far corner none. */
export function fadeRadius(
  cx: number,
  cy: number,
  points: readonly (readonly [number, number])[],
): number {
  let max = 0;
  for (const [x, y] of points) {
    max = Math.max(max, Math.hypot(x - cx, y - cy));
  }
  return max;
}

/** Fill opacity for a light at `level` (0–1 brightness). A fade starts a
 * bit stronger at the marker than an even fill, since it falls off. */
export function lightAreaOpacity(level: number, fade: boolean): number {
  const l = Math.min(1, Math.max(0, level));
  return fade ? 0.3 + 0.5 * l : 0.18 + 0.37 * l;
}

/** Gradient stops for the fade: [offset 0–1, share of the start opacity].
 * Eases out rather than falling off in a straight line, which reads more
 * like light spreading through a room. */
export const FADE_STOPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.25, 0.7],
  [0.5, 0.4],
  [0.75, 0.15],
  [1, 0],
];

/** An SVG id for the pin's gradient: only characters an id url() takes. */
export function fadeGradientId(pinId: string): string {
  return `light-fade-${pinId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}
