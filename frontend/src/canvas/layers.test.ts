import { describe, expect, it } from "vitest";
import type { PlaceableEntity } from "../types";
import {
  builtinLayerFor,
  deviceLayerIds,
  isOnVisibleLayer,
  labelLayerId,
  layerDefs,
} from "./layers";

function entity(
  entity_id: string,
  device_id: string,
  device_class: string | null = null,
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

const labels = [
  { label_id: "garden", name: "Garden", icon: "mdi:flower", color: null },
  { label_id: "kids", name: "Kids", icon: null, color: null },
];

describe("layers", () => {
  it("puts a device on a standard layer from its main entity", () => {
    expect(builtinLayerFor(entity("light.lamp", "d"))).toBe("lights");
    expect(builtinLayerFor(entity("media_player.tv", "d"))).toBe("screens");
    expect(builtinLayerFor(entity("binary_sensor.front", "d", "door"))).toBe(
      "security",
    );
    expect(builtinLayerFor(entity("binary_sensor.hall", "d", "motion"))).toBe(
      "sensors",
    );
    expect(builtinLayerFor(entity("vacuum.robot", "d"))).toBe("other");
    expect(builtinLayerFor(null)).toBe("other");
  });

  it("lists kept standard layers, then label layers that still exist", () => {
    const defs = layerDefs(["other", "zigbee"], ["kids", "gone"], labels);
    expect(defs.map((d) => d.id)).toEqual([
      "lights",
      "switches",
      "sensors",
      "climate",
      "screens",
      "cameras",
      "security",
      labelLayerId("kids"),
    ]);
    expect(defs[defs.length - 1]).toMatchObject({
      kind: "label",
      name: "Kids",
      icon: "mdi:label-outline",
    });
  });

  it("puts a device on its standard layer and every label layer it carries", () => {
    const entities = [entity("light.porch", "d1")];
    const defs = layerDefs([], ["garden", "kids"], labels);
    const deviceLabels = new Map([["d1", ["garden", "kids", "unused"]]]);
    expect(deviceLayerIds("d1", entities, deviceLabels, defs)).toEqual([
      "lights",
      labelLayerId("garden"),
      labelLayerId("kids"),
    ]);
    expect(deviceLayerIds(null, entities, deviceLabels, defs)).toEqual([]);
  });

  it("shows a device while any of its layers is on", () => {
    const off = new Set(["lights"]);
    expect(isOnVisibleLayer(["lights"], off)).toBe(false);
    expect(isOnVisibleLayer(["lights", labelLayerId("garden")], off)).toBe(
      true,
    );
    expect(isOnVisibleLayer([], off)).toBe(true);
  });
});
