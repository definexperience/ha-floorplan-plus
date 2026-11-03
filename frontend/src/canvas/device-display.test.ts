import { describe, expect, it } from "vitest";
import type { PlaceableEntity } from "../types";
import {
  belongsToKey,
  entityIconName,
  entityIdOfKey,
  entityKey,
  pickDisplayEntity,
  pinDisplayLabel,
  pinKey,
} from "./device-display";
import { deviceStatus } from "./device-state";
import { emptyPin } from "../ha-client";

function entity(
  entity_id: string,
  device_id: string | null,
  name = entity_id,
): PlaceableEntity {
  return {
    entity_id,
    name,
    domain: entity_id.split(".")[0]!,
    device_class: null,
    area_id: null,
    area_name: null,
    device_id,
    device_name: device_id ? "Relay board" : null,
    entity_category: null,
    integration_domain: "mqtt",
    integration_name: "MQTT",
    placed_floor_id: null,
    placed_floor_name: null,
  };
}

// A relay board switching two lights, and a helper with no device.
const entities = [
  entity("light.kitchen", "relay", "Relay board Kitchen"),
  entity("light.hall", "relay", "Relay board Hall"),
  entity("input_boolean.guests", null, "Guests"),
];

describe("pin keys", () => {
  it("keys a device pin by its device and an entity pin by its entity", () => {
    expect(pinKey({ device_id: "relay" })).toBe("relay");
    expect(pinKey({ device_id: null, single_entity_id: "light.hall" })).toBe(
      "entity:light.hall",
    );
    expect(entityIdOfKey(entityKey("light.hall"))).toBe("light.hall");
    expect(entityIdOfKey("relay")).toBeNull();
  });

  it("creates an entity pin with no device, and a device pin as before", () => {
    const single = emptyPin(entityKey("light.hall"), 1, 2, null);
    expect(single.device_id).toBeNull();
    expect(single.single_entity_id).toBe("light.hall");
    const device = emptyPin("relay", 1, 2, null);
    expect(device.device_id).toBe("relay");
    expect("single_entity_id" in device).toBe(false);
  });

  it("matches only the one entity for an entity key", () => {
    const key = entityKey("light.hall");
    expect(entities.filter((e) => belongsToKey(key, e))).toHaveLength(1);
    expect(entities.filter((e) => belongsToKey("relay", e))).toHaveLength(2);
    expect(pickDisplayEntity(key, entities)?.entity_id).toBe("light.hall");
  });

  it("names an entity pin after the entity, not its relay board", () => {
    expect(pinDisplayLabel(entityKey("light.hall"), entities)).toBe(
      "Relay board Hall",
    );
    expect(pinDisplayLabel("relay", entities)).toBe("Relay board");
    expect(pinDisplayLabel(entityKey("input_boolean.guests"), entities)).toBe(
      "Guests",
    );
  });

  it("gives each relay channel its own state", () => {
    const states = {
      "light.kitchen": { state: "on", attributes: {} },
      "light.hall": { state: "off", attributes: {} },
    };
    expect(
      deviceStatus(entityKey("light.kitchen"), entities, states).tone,
    ).toBe("active");
    expect(deviceStatus(entityKey("light.hall"), entities, states).tone).toBe(
      "idle",
    );
  });

  it("draws an entity with its own icon, else its domain's", () => {
    expect(entityIconName({ ...entities[2]!, icon: "mdi:account-group" })).toBe(
      "mdi:account-group",
    );
    expect(entityIconName(entities[2]!)).toBe("mdi:toggle-switch-outline");
  });
});
