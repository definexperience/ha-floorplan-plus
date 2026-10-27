import { describe, expect, it } from "vitest";
import type { HassEntityState, PlaceableEntity } from "../types";
import { deviceStatus, statusSignature } from "./device-state";

function entity(
  entity_id: string,
  device_id: string,
  device_class: string | null = null,
  entity_category: string | null = null,
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
    entity_category,
    integration_domain: null,
    integration_name: null,
    placed_floor_id: null,
    placed_floor_name: null,
  };
}

function st(state: string, attributes: Record<string, unknown> = {}) {
  return { state, attributes } satisfies HassEntityState;
}

describe("deviceStatus", () => {
  it("lights a pin that is on and greys one that is off", () => {
    const entities = [entity("light.lamp", "d1")];
    expect(deviceStatus("d1", entities, { "light.lamp": st("on") }).tone).toBe(
      "active",
    );
    expect(deviceStatus("d1", entities, { "light.lamp": st("off") }).tone).toBe(
      "idle",
    );
  });

  it("glows a light that is on in its colour and brightness", () => {
    const entities = [entity("light.lamp", "d1")];
    expect(
      deviceStatus("d1", entities, {
        "light.lamp": st("on", { rgb_color: [255, 0, 128], brightness: 51 }),
      }).light,
    ).toEqual({ color: "rgb(255,0,128)", level: 0.2 });
    expect(
      deviceStatus("d1", entities, { "light.lamp": st("on") }).light,
    ).toEqual({ color: "rgb(255,214,140)", level: 1 });
    expect(
      deviceStatus("d1", entities, { "light.lamp": st("off") }).light,
    ).toBeNull();
  });

  it("marks a device offline when its main entity is unavailable", () => {
    const entities = [entity("switch.plug", "d1")];
    expect(
      deviceStatus("d1", entities, { "switch.plug": st("unavailable") }).tone,
    ).toBe("offline");
  });

  it("warns about an open door, also on a multi-sensor", () => {
    const door = [entity("binary_sensor.front", "d1", "door")];
    expect(
      deviceStatus("d1", door, { "binary_sensor.front": st("on") }).tone,
    ).toBe("alert");

    const multi = [
      entity("climate.thermo", "d2"),
      entity("binary_sensor.window", "d2", "window"),
    ];
    expect(
      deviceStatus("d2", multi, {
        "climate.thermo": st("off"),
        "binary_sensor.window": st("on"),
      }).tone,
    ).toBe("alert");
  });

  it("shows motion as active", () => {
    const entities = [entity("binary_sensor.hall_motion", "d1", "motion")];
    expect(
      deviceStatus("d1", entities, { "binary_sensor.hall_motion": st("on") })
        .tone,
    ).toBe("active");
  });

  it("puts the temperature in the badge and flags a low battery", () => {
    const entities = [
      entity("sensor.kitchen_temp", "d1", "temperature"),
      entity("sensor.kitchen_battery", "d1", "battery", "diagnostic"),
    ];
    const status = deviceStatus("d1", entities, {
      "sensor.kitchen_temp": st("19.84"),
      "sensor.kitchen_battery": st("12"),
    });
    expect(status).toEqual({
      tone: "neutral",
      badge: "19.8°",
      lowBattery: true,
      light: null,
    });
  });

  it("ignores other devices' entities and unknown readings", () => {
    const entities = [
      entity("sensor.a_temp", "a", "temperature"),
      entity("sensor.b_temp", "b", "temperature"),
    ];
    const status = deviceStatus("a", entities, {
      "sensor.a_temp": st("unknown"),
      "sensor.b_temp": st("21"),
    });
    expect(status.badge).toBeNull();
  });

  it("returns a neutral status for a device it knows nothing about", () => {
    expect(deviceStatus(null, [], {})).toEqual({
      tone: "neutral",
      badge: null,
      lowBattery: false,
    });
  });
});

describe("statusSignature", () => {
  it("changes only when something visible changes", () => {
    const a = new Map([
      ["d1", { tone: "idle" as const, badge: "20°", lowBattery: false }],
    ]);
    const b = new Map([
      ["d1", { tone: "idle" as const, badge: "20°", lowBattery: false }],
    ]);
    const c = new Map([
      ["d1", { tone: "active" as const, badge: "20°", lowBattery: false }],
    ]);
    const d = new Map([
      [
        "d1",
        {
          tone: "active" as const,
          badge: "20°",
          lowBattery: false,
          light: { color: "rgb(255,214,140)", level: 0.5 },
        },
      ],
    ]);
    expect(statusSignature(a)).toBe(statusSignature(b));
    expect(statusSignature(a)).not.toBe(statusSignature(c));
    expect(statusSignature(c)).not.toBe(statusSignature(d));
  });
});
