import type { HassEntityState, PlaceableEntity } from "../types";
import { pickDisplayEntity } from "./device-display";

/** How a placed device looks in view mode, from its live Home Assistant
 * states: the pin's colour (tone), an optional short reading next to it
 * (badge), and whether any of its batteries is low. */
export type DeviceTone = "active" | "idle" | "alert" | "offline" | "neutral";

export interface DeviceStatus {
  tone: DeviceTone;
  badge: string | null;
  lowBattery: boolean;
  /** A light that's on: the glow drawn around its pin, in the light's own
   * colour, stronger the brighter it is. */
  light?: LightGlow | null;
}

export interface LightGlow {
  /** CSS colour, e.g. "rgb(255,180,90)". */
  color: string;
  /** Brightness from 0 to 1. */
  level: number;
}

/** A light with no colour of its own (a plain dimmable bulb) glows in a
 * warm white. */
const WARM_WHITE = "rgb(255,214,140)";

/** The glow for a light entity's state, or null when it's off, offline,
 * or not a light. */
export function lightGlow(
  entity: PlaceableEntity,
  state: HassEntityState | undefined,
): LightGlow | null {
  if (entity.domain !== "light" || state?.state !== "on") return null;
  const rgb = state.attributes?.["rgb_color"];
  const color =
    Array.isArray(rgb) &&
    rgb.length === 3 &&
    rgb.every((c) => typeof c === "number" && Number.isFinite(c))
      ? `rgb(${rgb.map((c) => Math.round(clamp(c as number, 0, 255))).join(",")})`
      : WARM_WHITE;
  const brightness = state.attributes?.["brightness"];
  const level =
    typeof brightness === "number" && Number.isFinite(brightness)
      ? clamp(brightness / 255, 0, 1)
      : 1;
  return { color, level };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Below this a battery counts as low, matching HA's own battery icons. */
export const LOW_BATTERY_PERCENT = 20;

const ON_DOMAINS = new Set([
  "light",
  "switch",
  "fan",
  "input_boolean",
  "humidifier",
  "siren",
]);
const ACTIVE_STATES = new Set(["on", "playing", "cleaning", "heat", "cool"]);
const OPEN_DOOR_CLASSES = new Set(["door", "window", "opening", "garage_door"]);
const MOTION_CLASSES = new Set([
  "motion",
  "occupancy",
  "presence",
  "moving",
  "sound",
  "vibration",
]);
const ALARM_CLASSES = new Set([
  "problem",
  "smoke",
  "moisture",
  "gas",
  "safety",
  "carbon_monoxide",
  "tamper",
]);
const UNAVAILABLE = new Set(["unavailable", "unknown"]);

function deviceClassOf(
  entity: PlaceableEntity,
  state: HassEntityState | undefined,
): string | null {
  const fromState = state?.attributes?.["device_class"];
  return typeof fromState === "string" ? fromState : entity.device_class;
}

/** The tone the representative entity's state gives the whole device. */
function toneFor(
  entity: PlaceableEntity,
  state: HassEntityState | undefined,
): DeviceTone {
  if (!state || state.state === "unavailable") return "offline";
  const s = state.state;
  const domain = entity.domain;
  if (ON_DOMAINS.has(domain)) return s === "on" ? "active" : "idle";
  if (domain === "media_player" || domain === "vacuum") {
    return ACTIVE_STATES.has(s) ? "active" : "idle";
  }
  if (domain === "climate" || domain === "water_heater") {
    return s === "off" ? "idle" : "active";
  }
  if (domain === "cover" || domain === "valve") {
    return s === "open" || s === "opening" ? "alert" : "idle";
  }
  if (domain === "lock") {
    return s === "unlocked" || s === "open" || s === "opening"
      ? "alert"
      : "idle";
  }
  if (domain === "alarm_control_panel") {
    return s === "triggered" ? "alert" : s === "disarmed" ? "idle" : "active";
  }
  if (domain === "binary_sensor") {
    const dc = deviceClassOf(entity, state);
    if (dc && (OPEN_DOOR_CLASSES.has(dc) || ALARM_CLASSES.has(dc))) {
      return s === "on" ? "alert" : "idle";
    }
    if (dc && MOTION_CLASSES.has(dc)) return s === "on" ? "active" : "idle";
    return s === "on" ? "active" : "idle";
  }
  return "neutral";
}

function numeric(state: HassEntityState | undefined): number | null {
  if (!state || UNAVAILABLE.has(state.state)) return null;
  const n = Number(state.state);
  return Number.isFinite(n) ? n : null;
}

/** What a badge says for one entity's state: HA's own formatter when the
 * frontend has one, else the raw state plus its unit. */
export type StateFormatter = (state: HassEntityState) => string;

function plainFormat(state: HassEntityState): string {
  const unit = state.attributes?.["unit_of_measurement"];
  return typeof unit === "string" && unit
    ? `${state.state} ${unit}`
    : state.state;
}

/** A device's status in view mode. `entities` may hold every placeable
 * entity; only this device's own are used. The badge shows the reading
 * the admin picked for this device (`badgeEntityId`), and nothing when
 * none was picked. */
export function deviceStatus(
  deviceId: string | null,
  entities: Iterable<PlaceableEntity>,
  states: Record<string, HassEntityState | undefined>,
  badgeEntityId: string | null = null,
  format: StateFormatter = plainFormat,
): DeviceStatus {
  const own = [...entities].filter(
    (e) => deviceId !== null && e.device_id === deviceId,
  );
  const rep = pickDisplayEntity(deviceId, own);
  if (!rep) return { tone: "neutral", badge: null, lowBattery: false };

  let tone = toneFor(rep, states[rep.entity_id]);
  const light = lightGlow(rep, states[rep.entity_id]);
  let badge: string | null = null;
  const badgeState = own.some((e) => e.entity_id === badgeEntityId)
    ? states[badgeEntityId!]
    : undefined;
  if (badgeState && !UNAVAILABLE.has(badgeState.state)) {
    badge = format(badgeState);
  }
  let lowBattery = false;

  for (const e of own) {
    const st = states[e.entity_id];
    const dc = deviceClassOf(e, st);
    if (e.domain === "sensor" && dc === "battery") {
      const value = numeric(st);
      if (value !== null && value < LOW_BATTERY_PERCENT) lowBattery = true;
    }
    if (
      e.domain === "binary_sensor" &&
      dc === "battery" &&
      st?.state === "on"
    ) {
      lowBattery = true;
    }
    // A door contact on a device whose representative is something else
    // (a multi-sensor's temperature, say) still marks the device as open.
    if (
      e !== rep &&
      e.domain === "binary_sensor" &&
      dc &&
      OPEN_DOOR_CLASSES.has(dc) &&
      st?.state === "on" &&
      tone !== "offline"
    ) {
      tone = "alert";
    }
  }
  return { tone, badge, lowBattery, light };
}

/** Pin fill per tone. HA's own theme variables first, so a theme recolours
 * them; the fallbacks are HA's default palette. */
export function toneColor(tone: DeviceTone): string {
  switch (tone) {
    case "active":
      return "var(--state-active-color, var(--amber-color, #ffc107))";
    case "idle":
      return "var(--state-inactive-color, var(--disabled-color, #9e9e9e))";
    case "alert":
      return "var(--warning-color, #ff9800)";
    case "offline":
      return "var(--error-color, #db4437)";
    case "neutral":
      return "var(--sc-accent)";
  }
}

/** A stable text form of a set of statuses, so a state change that leaves
 * every pin looking the same doesn't re-render the plan. */
export function statusSignature(statuses: Map<string, DeviceStatus>): string {
  return [...statuses.entries()]
    .map(
      ([id, s]) =>
        `${id}:${s.tone}:${s.badge ?? ""}:${s.lowBattery ? 1 : 0}:` +
        (s.light ? `${s.light.color}@${s.light.level.toFixed(2)}` : ""),
    )
    .join("|");
}
