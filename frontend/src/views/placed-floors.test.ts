import { describe, expect, it } from "vitest";
import { otherFloorNames } from "./placed-floors";

describe("otherFloorNames", () => {
  it("lists every floor but the open one", () => {
    expect(
      otherFloorNames(
        ["ground", "first", "attic"],
        ["Ground floor", "First floor", null],
        "ground",
        "Ground floor",
        "first",
      ),
    ).toEqual(["Ground floor", "attic"]);
  });

  it("is empty when the device is only on the open floor", () => {
    expect(
      otherFloorNames(["first"], ["First floor"], null, null, "first"),
    ).toEqual([]);
  });

  it("falls back to the single floor an older backend sends", () => {
    expect(
      otherFloorNames(undefined, undefined, "ground", "Ground floor", "first"),
    ).toEqual(["Ground floor"]);
    expect(otherFloorNames(undefined, undefined, null, null, "first")).toEqual(
      [],
    );
  });
});
