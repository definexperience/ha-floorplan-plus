import type { DetectionZone, PlaceableEntity } from "../types";

/** A presence radar's or camera's coverage on the plan: a wedge from the
 * device's marker, `range_m` long and `angle_deg` wide, facing
 * `rotation_deg` (0 = up on the plan, clockwise). Off unless an admin
 * turns it on for the device. */

/** A typical mmWave presence sensor (HLK-LD2410/LD2450 class). */
export const DEFAULT_DETECTION_ZONE: DetectionZone = {
  range_m: 6,
  angle_deg: 120,
  rotation_deg: 0,
  entity_id: null,
};

const DETECTION_CLASSES = ["occupancy", "presence", "motion", "moving"];

/** The device's binary sensors that can colour its zone, best first. */
export function detectionEntities(
  deviceId: string | null,
  entities: Iterable<PlaceableEntity>,
): PlaceableEntity[] {
  if (!deviceId) return [];
  const rank = (e: PlaceableEntity): number => {
    const i = DETECTION_CLASSES.indexOf(e.device_class ?? "");
    return (
      (i === -1 ? DETECTION_CLASSES.length : i) + (e.entity_category ? 10 : 0)
    );
  };
  return [...entities]
    .filter((e) => e.device_id === deviceId && e.domain === "binary_sensor")
    .sort((a, b) => rank(a) - rank(b));
}

/** The entity that colours the zone: the admin's pick, else the device's
 * best occupancy/presence/motion sensor. */
export function zoneEntityId(
  zone: DetectionZone,
  deviceId: string | null,
  entities: Iterable<PlaceableEntity>,
): string | null {
  if (zone.entity_id) return zone.entity_id;
  const best = detectionEntities(deviceId, entities)[0];
  return best && DETECTION_CLASSES.includes(best.device_class ?? "")
    ? best.entity_id
    : null;
}

/** SVG path data for the wedge, in plan units. */
export function wedgePath(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
  rotationDeg: number,
): string {
  const r = Math.max(0, radius);
  const angle = Math.min(360, Math.max(1, angleDeg));
  if (angle >= 360) {
    return (
      `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 ` +
      `a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
    );
  }
  const point = (deg: number): [number, number] => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
  };
  const [x1, y1] = point(rotationDeg - angle / 2);
  const [x2, y2] = point(rotationDeg + angle / 2);
  const large = angle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}
