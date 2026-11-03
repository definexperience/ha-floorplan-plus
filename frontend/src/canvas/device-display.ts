import type { PlaceableEntity, Pin } from "../types";

/** A pin places either a whole device or one entity on its own (one
 * channel of a relay board, or an entity with no device). Its "key" says
 * which: the device_id itself, unchanged from before entity pins existed,
 * or `entity:<entity_id>`. Everything that looks a pin up (statuses,
 * "already placed", the picker) goes by this key. */
const ENTITY_KEY_PREFIX = "entity:";

export function entityKey(entityId: string): string {
  return ENTITY_KEY_PREFIX + entityId;
}

export function isEntityKey(key: string | null): boolean {
  return !!key && key.startsWith(ENTITY_KEY_PREFIX);
}

/** The entity_id inside an `entity:` key, else null. */
export function entityIdOfKey(key: string | null): string | null {
  return key && isEntityKey(key) ? key.slice(ENTITY_KEY_PREFIX.length) : null;
}

export function pinKey(
  pin: Pick<Pin, "device_id" | "single_entity_id">,
): string | null {
  if (pin.single_entity_id) return entityKey(pin.single_entity_id);
  return pin.device_id;
}

/** Whether `entity` is part of what the pin with this key places. */
export function belongsToKey(
  key: string | null,
  entity: PlaceableEntity,
): boolean {
  if (!key) return false;
  const entityId = entityIdOfKey(key);
  return entityId !== null
    ? entity.entity_id === entityId
    : entity.device_id === key;
}

/** Mirrors registry_snapshot.py's _DOMAIN_PRIORITY exactly — keep both in
 * sync if this list changes. Sensor deliberately last: a helper integration
 * (e.g. Dynamic Energy Cost) that attaches its own sensor entities to
 * another integration's device must never outrank that device's own
 * switch/light/etc. entity as its "representative" (see pickDisplayEntity). */
const DOMAIN_PRIORITY = [
  "light",
  "switch",
  "climate",
  "media_player",
  "lock",
  "cover",
  "fan",
  "vacuum",
  "alarm_control_panel",
  "valve",
  "humidifier",
  "siren",
  "water_heater",
  "camera",
  "assist_satellite",
  "device_tracker",
  "binary_sensor",
  "sensor",
];

/** Placement — and everything derived from a pin afterward (its icon, its
 * displayed name) — is about the physical DEVICE, never an entity; a human
 * placing "the U6+ access point" should never need to know or choose which
 * of its ten HA entities represents it. But which entity gets asked also
 * isn't arbitrary: a helper integration (Dynamic Energy Cost, a utility
 * meter, ...) can attach its own entities to another integration's device,
 * and those don't share that device's own `integration_domain`/name intent
 * even though `device_id` matches — so a real ranking is needed, the same
 * one registry_snapshot.py's pick_display_entity already uses for the
 * export (category rank, then domain priority) so the UI and the exported
 * JSON agree on which entity represents a device. */
export function pickDisplayEntity(
  deviceId: string | null,
  entities: Iterable<PlaceableEntity>,
): PlaceableEntity | null {
  if (!deviceId) return null;
  const candidates = [...entities].filter((e) => belongsToKey(deviceId, e));
  if (candidates.length === 0) return null;

  const categoryRank = (e: PlaceableEntity): number =>
    e.entity_category === "config" ? 2 : e.entity_category ? 1 : 0;
  const domainRank = (e: PlaceableEntity): number => {
    const i = DOMAIN_PRIORITY.indexOf(e.domain);
    return i === -1 ? DOMAIN_PRIORITY.length : i;
  };

  candidates.sort(
    (a, b) =>
      categoryRank(a) - categoryRank(b) || domainRank(a) - domainRank(b),
  );
  return candidates[0]!;
}

/** A pin's displayed name when it has no label_override — the device's own
 * name (never an entity's, which can be a more specific sub-entity name
 * like a camera stream's "High resolution channel"), or a clean, honest
 * "Unknown device" when nothing resolves (never a raw entity_id — that's
 * internal plumbing, not something a person placing a device should ever
 * see). */
export function pinDisplayLabel(
  deviceId: string | null,
  entities: Iterable<PlaceableEntity>,
): string {
  const rep = pickDisplayEntity(deviceId, entities);
  // An entity on a pin of its own goes by its own name ("Kitchen light"),
  // not its relay board's.
  if (isEntityKey(deviceId)) return rep?.name ?? "Unknown entity";
  return rep?.device_name ?? "Unknown device";
}

/** Which integration set up this device (e.g. "unifi", "esphome", "hue") —
 * a true device-level fact, unlike an entity's domain (light/sensor/...),
 * which only describes one facet of what the device happens to expose and
 * is not what a device "is". Used to show that integration's own brand
 * icon on the map (see floorplan-canvas.ts's _iconForPin) instead of
 * guessing a glyph from an arbitrary entity's domain. */
export function pinIntegrationDomain(
  deviceId: string | null,
  entities: Iterable<PlaceableEntity>,
): string | null {
  return pickDisplayEntity(deviceId, entities)?.integration_domain ?? null;
}

/** HA's default icon per domain, for an entity pin whose entity has no
 * icon of its own — a relay channel's switch should look like a switch,
 * not like its relay board's integration logo. */
const DOMAIN_ICONS: Record<string, string> = {
  light: "mdi:lightbulb",
  switch: "mdi:toggle-switch-variant",
  sensor: "mdi:eye",
  binary_sensor: "mdi:radiobox-blank",
  climate: "mdi:thermostat",
  lock: "mdi:lock",
  cover: "mdi:window-shutter",
  camera: "mdi:video",
  media_player: "mdi:cast",
  fan: "mdi:fan",
  humidifier: "mdi:air-humidifier",
  vacuum: "mdi:robot-vacuum",
  alarm_control_panel: "mdi:shield",
  water_heater: "mdi:thermometer",
  device_tracker: "mdi:account",
  valve: "mdi:valve",
  siren: "mdi:bullhorn",
  assist_satellite: "mdi:account-voice",
  input_boolean: "mdi:toggle-switch-outline",
  input_number: "mdi:ray-vertex",
  input_select: "mdi:format-list-bulleted",
  counter: "mdi:counter",
  timer: "mdi:timer-outline",
  scene: "mdi:palette",
  script: "mdi:script-text",
  person: "mdi:account",
};

/** The mdi icon name for an entity drawn on a pin of its own: its own
 * icon, else its domain's. */
export function entityIconName(entity: PlaceableEntity): string {
  return (
    entity.icon ||
    DOMAIN_ICONS[entity.domain] ||
    "mdi:checkbox-blank-circle-outline"
  );
}
