/** The floor plan's on-screen rotation (FloorLayout.view_angle, or a
 * card's display_angle).
 *
 * Everything on a floor is stored in "image" coordinates. The canvas draws
 * it turned `deg` degrees clockwise around the origin, and its pan/zoom
 * viewBox lives in that turned "view" space — so panning and zooming work
 * exactly as they do unrotated, and only conversions between screen and
 * stored positions (taps, drags, framing) go through these helpers. */

export type Point = [number, number];

/** -180..180, with 180 kept as 180. Anything not finite reads as 0. */
export function normalizeAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let a = deg % 360;
  if (a > 180) a -= 360;
  else if (a <= -180) a += 360;
  return a === 0 ? 0 : a; // no -0
}

/** Turns (x, y) `deg` degrees clockwise around the origin (SVG's y axis
 * points down, so this matches SVG's own `rotate(deg)`). */
export function rotatePoint(x: number, y: number, deg: number): Point {
  if (!deg) return [x, y];
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [x * cos - y * sin, x * sin + y * cos];
}

/** Image -> view space. */
export function toView(x: number, y: number, deg: number): Point {
  return rotatePoint(x, y, deg);
}

/** View -> image space. */
export function toImage(x: number, y: number, deg: number): Point {
  return rotatePoint(x, y, -deg);
}

/** The axis-aligned box around these points once turned into view space. */
export function viewBounds(
  points: Point[],
  deg: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    const [x, y] = toView(px, py, deg);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** The four corners of a view-space rectangle, in image space. */
export function viewRectInImage(
  rect: { x: number; y: number; w: number; h: number },
  deg: number,
): Point[] {
  return [
    toImage(rect.x, rect.y, deg),
    toImage(rect.x + rect.w, rect.y, deg),
    toImage(rect.x + rect.w, rect.y + rect.h, deg),
    toImage(rect.x, rect.y + rect.h, deg),
  ];
}

/** Keeps the image point at the view's center fixed on screen while the
 * angle changes from `fromDeg` to `toDeg`; the zoom stays as it was. */
export function reangleViewBox(
  vb: { x: number; y: number; w: number; h: number },
  fromDeg: number,
  toDeg: number,
): { x: number; y: number; w: number; h: number } {
  const [ix, iy] = toImage(vb.x + vb.w / 2, vb.y + vb.h / 2, fromDeg);
  const [cx, cy] = toView(ix, iy, toDeg);
  return { x: cx - vb.w / 2, y: cy - vb.h / 2, w: vb.w, h: vb.h };
}
