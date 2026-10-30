import type { NetworkType, PlaceableEntity } from "../types";
import { pickDisplayEntity } from "./device-display";

/** Layers group placed devices so a viewer can show only some of them.
 * Every device lands on one standard layer automatically, from the kind
 * of device it is; Home Assistant labels the admin turns into layers add
 * more, and a device can carry several of those. */

export type BuiltinLayerId =
  | "lights"
  | "switches"
  | "sensors"
  | "climate"
  | "screens"
  | "cameras"
  | "security"
  | "other";

export const BUILTIN_LAYERS: { id: BuiltinLayerId; icon: string }[] = [
  { id: "lights", icon: "mdi:lightbulb-outline" },
  { id: "switches", icon: "mdi:toggle-switch-outline" },
  { id: "sensors", icon: "mdi:motion-sensor" },
  { id: "climate", icon: "mdi:thermostat" },
  { id: "screens", icon: "mdi:television" },
  { id: "cameras", icon: "mdi:cctv" },
  { id: "security", icon: "mdi:shield-home-outline" },
  { id: "other", icon: "mdi:devices" },
];

export const NETWORK_LAYERS: { id: NetworkType; icon: string }[] = [
  { id: "zigbee", icon: "mdi:zigbee" },
  { id: "wifi", icon: "mdi:wifi" },
  { id: "matter", icon: "mdi:router-wireless" },
  { id: "bluetooth", icon: "mdi:bluetooth" },
];

/** A Home Assistant label (config/label_registry/list). */
export interface LabelEntry {
  label_id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface LayerDef {
  /** A BuiltinLayerId, or labelLayerId(label_id). */
  id: string;
  kind: "builtin" | "label";
  icon: string;
  /** Set for a label layer; a standard layer's name is translated. */
  name?: string;
  labelId?: string;
}

export function labelLayerId(labelId: string): string {
  return `label:${labelId}`;
}

const SECURITY_CLASSES = new Set([
  "door",
  "window",
  "opening",
  "garage_door",
  "smoke",
  "gas",
  "carbon_monoxide",
  "moisture",
  "safety",
  "tamper",
]);

/** The standard layer a device belongs to, from its main entity. */
export function builtinLayerFor(rep: PlaceableEntity | null): BuiltinLayerId {
  if (!rep) return "other";
  switch (rep.domain) {
    case "light":
      return "lights";
    case "switch":
    case "input_boolean":
    case "valve":
      return "switches";
    case "climate":
    case "water_heater":
    case "humidifier":
    case "fan":
      return "climate";
    case "media_player":
    case "remote":
      return "screens";
    case "camera":
      return "cameras";
    case "lock":
    case "alarm_control_panel":
    case "siren":
      return "security";
    case "binary_sensor":
      return rep.device_class && SECURITY_CLASSES.has(rep.device_class)
        ? "security"
        : "sensors";
    case "sensor":
      return "sensors";
    default:
      return "other";
  }
}

/** The layers in use: the standard ones the admin hasn't removed, then
 * the labels picked as layers (in that order), skipping labels that no
 * longer exist. */
export function layerDefs(
  hiddenLayers: readonly string[],
  labelLayers: readonly string[],
  labels: readonly LabelEntry[],
): LayerDef[] {
  const hidden = new Set(hiddenLayers);
  const defs: LayerDef[] = BUILTIN_LAYERS.filter((l) => !hidden.has(l.id)).map(
    (l) => ({ id: l.id, kind: "builtin", icon: l.icon }),
  );
  for (const labelId of labelLayers) {
    const label = labels.find((l) => l.label_id === labelId);
    if (!label) continue;
    defs.push({
      id: labelLayerId(labelId),
      kind: "label",
      icon: label.icon || "mdi:label-outline",
      name: label.name,
      labelId,
    });
  }
  return defs;
}

/** The layers (of `defs`) a device is on. */
export function deviceLayerIds(
  deviceId: string | null,
  entities: Iterable<PlaceableEntity>,
  deviceLabels: ReadonlyMap<string, readonly string[]>,
  defs: readonly LayerDef[],
): string[] {
  if (!deviceId) return [];
  const builtin = builtinLayerFor(pickDisplayEntity(deviceId, entities));
  const labels = new Set(deviceLabels.get(deviceId) ?? []);
  return defs
    .filter((d) =>
      d.kind === "builtin" ? d.id === builtin : labels.has(d.labelId!),
    )
    .map((d) => d.id);
}

/** A device shows while any of its layers is on. One on no layer at all
 * (its standard layer removed, no label layers) always shows. */
export function isOnVisibleLayer(
  layerIds: readonly string[],
  off: ReadonlySet<string>,
): boolean {
  return layerIds.length === 0 || layerIds.some((id) => !off.has(id));
}
