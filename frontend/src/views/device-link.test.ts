import { describe, expect, it } from "vitest";
import type { PlaceableEntity } from "../types";
import { canOpenInternal, parseLink, resolveDeviceLink } from "./device-link";

function entity(
  entity_id: string,
  device_id: string | null,
  url: string | null,
): PlaceableEntity {
  return {
    entity_id,
    name: entity_id,
    domain: entity_id.split(".")[0] ?? "",
    device_class: null,
    area_id: null,
    area_name: null,
    device_id,
    device_name: null,
    entity_category: null,
    integration_domain: null,
    integration_name: null,
    device_configuration_url: url,
    placed_floor_id: null,
    placed_floor_name: null,
  };
}

const entities = [
  entity("sensor.station_temp", "station", "homeassistant://stations/abc"),
  entity("switch.plug", "plug", "http://192.0.2.4/"),
  entity("light.lamp", "lamp", null),
];
const user = {
  user: { is_admin: false },
  panels: { stations: {}, lovelace: {} },
};

describe("parseLink", () => {
  it("opens homeassistant:// links inside Home Assistant", () => {
    expect(parseLink("homeassistant://stations/abc", "device")).toEqual({
      href: "/stations/abc",
      internal: true,
      source: "device",
    });
  });

  it("keeps paths inside Home Assistant and web addresses outside", () => {
    expect(parseLink(" /lovelace/home ", "custom")?.internal).toBe(true);
    expect(parseLink("https://example.com/x", "custom")?.internal).toBe(false);
  });

  it("refuses anything else", () => {
    for (const bad of [
      "",
      "javascript:alert(1)",
      "//evil.example",
      "ftp://x",
      "home",
    ]) {
      expect(parseLink(bad, "custom")).toBeNull();
    }
  });
});

describe("resolveDeviceLink", () => {
  it("shows the device's own link by default", () => {
    expect(resolveDeviceLink({}, "station", entities, user)?.href).toBe(
      "/stations/abc",
    );
    expect(resolveDeviceLink(undefined, "plug", entities, user)?.href).toBe(
      "http://192.0.2.4/",
    );
  });

  it("shows nothing for a device without a link", () => {
    expect(resolveDeviceLink({}, "lamp", entities, user)).toBeNull();
  });

  it("uses the device's link for one of its entities on a pin of its own", () => {
    expect(
      resolveDeviceLink({}, "entity:sensor.station_temp", entities, user)?.href,
    ).toBe("/stations/abc");
  });

  it("uses the custom link instead, also on a device without one", () => {
    const pin = {
      link_mode: "custom" as const,
      custom_link: "/lovelace/garden",
    };
    expect(resolveDeviceLink(pin, "station", entities, user)?.href).toBe(
      "/lovelace/garden",
    );
    expect(resolveDeviceLink(pin, "lamp", entities, user)?.source).toBe(
      "custom",
    );
  });

  it("shows no link when the admin turned it off", () => {
    expect(
      resolveDeviceLink({ link_mode: "none" }, "station", entities, user),
    ).toBeNull();
  });

  it("hides a link to a page this user can't open", () => {
    const pin = {
      link_mode: "custom" as const,
      custom_link: "/config/devices",
    };
    expect(resolveDeviceLink(pin, "lamp", entities, user)).toBeNull();
    const admin = { user: { is_admin: true }, panels: {} };
    expect(resolveDeviceLink(pin, "lamp", entities, admin)?.href).toBe(
      "/config/devices",
    );
  });
});

describe("canOpenInternal", () => {
  it("checks the page's panel, ignoring a query or hash", () => {
    expect(canOpenInternal("/stations?x=1", user)).toBe(true);
    expect(canOpenInternal("/lovelace#a", user)).toBe(true);
    expect(canOpenInternal("/hassio/dashboard", user)).toBe(false);
  });

  it("shows the link when Home Assistant sends no panel list", () => {
    expect(canOpenInternal("/anything", { user: { is_admin: false } })).toBe(
      true,
    );
  });
});
