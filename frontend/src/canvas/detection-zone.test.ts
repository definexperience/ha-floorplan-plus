import { describe, expect, it } from "vitest";
import type { PlaceableEntity } from "../types";
import {
  DEFAULT_DETECTION_ZONE,
  detectionEntities,
  wedgePath,
  zoneEntityId,
} from "./detection-zone";

function entity(
  entity_id: string,
  device_class: string | null,
  device_id = "d1",
): PlaceableEntity {
  return {
    entity_id,
    name: entity_id,
    domain: entity_id.split(".")[0]!,
    device_class,
    area_id: null,
    area_name: null,
    device_id,
    device_name: device_id,
    entity_category: null,
    integration_domain: null,
    integration_name: null,
    placed_floor_id: null,
    placed_floor_name: null,
  };
}

describe("detection zone", () => {
  it("draws a wedge facing up for rotation 0", () => {
    const d = wedgePath(0, 0, 10, 90, 0);
    const nums = d.match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number);
    // M 0 0 L x1 y1 A 10 10 0 0 1 x2 y2 Z
    const [, , x1, y1, , , , large, sweep, x2, y2] = nums;
    expect(x1).toBeCloseTo(-7.071, 2);
    expect(y1).toBeCloseTo(-7.071, 2);
    expect(x2).toBeCloseTo(7.071, 2);
    expect(y2).toBeCloseTo(-7.071, 2);
    expect(large).toBe(0);
    expect(sweep).toBe(1);
  });

  it("uses the large arc past 180 degrees and a circle at 360", () => {
    expect(wedgePath(0, 0, 5, 270, 90)).toContain(" 0 1 1 ");
    expect(wedgePath(0, 0, 5, 360, 0)).not.toContain("L");
  });

  it("colours with the picked sensor, else the best presence sensor", () => {
    const entities = [
      entity("binary_sensor.door", "door"),
      entity("binary_sensor.motion", "motion"),
      entity("binary_sensor.presence", "presence"),
      entity("binary_sensor.other_presence", "presence", "d2"),
    ];
    expect(detectionEntities("d1", entities).map((e) => e.entity_id)).toEqual([
      "binary_sensor.presence",
      "binary_sensor.motion",
      "binary_sensor.door",
    ]);
    expect(zoneEntityId(DEFAULT_DETECTION_ZONE, "d1", entities)).toBe(
      "binary_sensor.presence",
    );
    expect(
      zoneEntityId(
        { ...DEFAULT_DETECTION_ZONE, entity_id: "binary_sensor.door" },
        "d1",
        entities,
      ),
    ).toBe("binary_sensor.door");
    expect(
      zoneEntityId(DEFAULT_DETECTION_ZONE, "d1", [
        entity("binary_sensor.door", "door"),
      ]),
    ).toBeNull();
  });
});
