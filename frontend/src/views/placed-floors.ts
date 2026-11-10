/** Names of the floors in `ids` other than `current`. Falls back to the
 * single first-floor fields a backend from before multi-floor placement
 * sends. */
export function otherFloorNames(
  ids: string[] | undefined,
  names: (string | null)[] | undefined,
  firstId: string | null,
  firstName: string | null,
  current: string | null,
): string[] {
  const floorIds = ids ?? (firstId ? [firstId] : []);
  const floorNames = ids ? (names ?? []) : [firstName];
  return floorIds
    .map((id, i) => (id === current ? null : (floorNames[i] ?? id)))
    .filter((name): name is string => name !== null);
}
