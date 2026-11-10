import { describe, expect, it } from "vitest";
import {
  normalizeAngle,
  reangleViewBox,
  rotatePoint,
  toImage,
  toView,
  viewBounds,
  viewRectInImage,
} from "./view-rotation";

const close = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 9);
  expect(a[1]).toBeCloseTo(b[1], 9);
};

describe("normalizeAngle", () => {
  it("folds into -180..180", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(90)).toBe(90);
    expect(normalizeAngle(270)).toBe(-90);
    expect(normalizeAngle(-190)).toBe(170);
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(720)).toBe(0);
    expect(Object.is(normalizeAngle(-360), 0)).toBe(true);
  });
  it("reads anything not finite as 0", () => {
    expect(normalizeAngle(NaN)).toBe(0);
    expect(normalizeAngle(Infinity)).toBe(0);
  });
});

describe("rotatePoint", () => {
  it("turns clockwise on screen, like SVG rotate()", () => {
    // y points down: a point to the right ends up below after +90°.
    close(rotatePoint(10, 0, 90), [0, 10]);
    close(rotatePoint(0, 10, 90), [-10, 0]);
    close(rotatePoint(3, 4, 180), [-3, -4]);
  });
  it("is the identity at 0°", () => {
    expect(rotatePoint(3, 4, 0)).toEqual([3, 4]);
  });
  it("toImage undoes toView", () => {
    for (const deg of [0, 17, 90, -135, 180]) {
      const [vx, vy] = toView(123, -45, deg);
      close(toImage(vx, vy, deg), [123, -45]);
    }
  });
});

describe("viewBounds", () => {
  it("is the turned box around the points", () => {
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const b = viewBounds(square, 45)!;
    const half = Math.SQRT2 * 5;
    expect(b.maxX - b.minX).toBeCloseTo(half * 2, 9);
    expect(b.maxY - b.minY).toBeCloseTo(half * 2, 9);
    const at90 = viewBounds(square, 90)!;
    expect(at90.minX).toBeCloseTo(-10, 9);
    expect(at90.maxX).toBeCloseTo(0, 9);
  });
  it("is null with nothing to frame", () => {
    expect(viewBounds([], 30)).toBeNull();
  });
});

describe("viewRectInImage", () => {
  it("gives the corners back in image space", () => {
    const corners = viewRectInImage({ x: -10, y: 0, w: 10, h: 10 }, 90);
    // At 90° the view rect (-10..0, 0..10) is image (0..10, 0..10).
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    expect(Math.min(...xs)).toBeCloseTo(0, 9);
    expect(Math.max(...xs)).toBeCloseTo(10, 9);
    expect(Math.min(...ys)).toBeCloseTo(0, 9);
    expect(Math.max(...ys)).toBeCloseTo(10, 9);
  });
});

describe("reangleViewBox", () => {
  it("keeps the same spot in the middle and the same zoom", () => {
    const vb = { x: 100, y: 50, w: 400, h: 300 };
    const next = reangleViewBox(vb, 0, 30);
    expect(next.w).toBe(400);
    expect(next.h).toBe(300);
    close(toImage(next.x + next.w / 2, next.y + next.h / 2, 30), [300, 200]);
  });
});
