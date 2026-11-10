import { describe, expect, it } from "vitest";
import {
  FADE_STOPS,
  fadeGradientId,
  fadeRadius,
  lightAreaOpacity,
} from "./light-area";

describe("fadeRadius", () => {
  it("reaches the farthest corner from the marker", () => {
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(fadeRadius(0, 0, square)).toBeCloseTo(Math.hypot(10, 10));
    expect(fadeRadius(5, 5, square)).toBeCloseTo(Math.hypot(5, 5));
    expect(fadeRadius(2, 5, square)).toBeCloseTo(Math.hypot(8, 5));
  });

  it("is 0 without points", () => {
    expect(fadeRadius(1, 1, [])).toBe(0);
  });
});

describe("lightAreaOpacity", () => {
  it("keeps the even fill's existing range", () => {
    expect(lightAreaOpacity(0, false)).toBeCloseTo(0.18);
    expect(lightAreaOpacity(1, false)).toBeCloseTo(0.55);
  });

  it("starts a fade stronger and clamps the level", () => {
    expect(lightAreaOpacity(1, true)).toBeCloseTo(0.8);
    expect(lightAreaOpacity(2, true)).toBeCloseTo(0.8);
    expect(lightAreaOpacity(-1, true)).toBeCloseTo(0.3);
  });
});

describe("fade gradient", () => {
  it("fades from full to nothing", () => {
    expect(FADE_STOPS[0]).toEqual([0, 1]);
    expect(FADE_STOPS[FADE_STOPS.length - 1]).toEqual([1, 0]);
  });

  it("makes a safe id", () => {
    expect(fadeGradientId("abc-1_2")).toBe("light-fade-abc-1_2");
    expect(fadeGradientId("a b:c")).toBe("light-fade-a_b_c");
  });
});
