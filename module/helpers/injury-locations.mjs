/**
 * Pure, Foundry-free hit-location tables for the injury system.
 *
 * Two tables, deliberately distinct:
 *  - the 1d12 "threshold" table (light, used for above-zero threshold + crit injuries)
 *  - the Mythras 1d20 anatomical table (used for below-zero death & dismemberment)
 *
 * Each resolver maps a die total to a location record. The Foundry-bound caller
 * owns the `Roll` (and, for the 1d12 table, the 1d2 side roll); the macros call
 * the same resolvers, so the tables have a single source of truth and are
 * node-testable. Mirrors the pure-module pattern of `injury-thresholds.mjs`.
 */

/**
 * 1d12 threshold location. `needsSide` true means the caller should roll 1d2
 * for a Left/Right prefix (the limb locations).
 * @param {number} total - 1d12 result
 * @returns {{ location: string, locationIcon: string, needsSide: boolean }}
 */
export function resolveThresholdLocation(total) {
  const roll = Number(total);
  if (roll <= 2) return { location: "arm", locationIcon: "hand", needsSide: true };
  if (roll <= 4) return { location: "leg", locationIcon: "person-walking", needsSide: true };
  if (roll <= 9) return { location: "torso", locationIcon: "vest", needsSide: false };
  return { location: "head", locationIcon: "head-side", needsSide: false };
}

/**
 * Mythras 1d20 anatomical hit location (ported from the wwn lineage). The result
 * string already encodes the side (e.g. "Right Leg"); `category` maps it onto the
 * arm/leg/torso/head effect buckets and `side` carries the Left/Right prefix for
 * the effect text, so no separate side roll is needed.
 *
 * @param {number} total - 1d20 result
 * @returns {{ location: string, details: string, locationIcon: string, category: string, side: string }}
 */
export function resolveMythrasLocation(total) {
  const roll = Number(total);
  const entry = MYTHRAS_TABLE.find((e) => roll >= e.range[0] && roll <= e.range[1]);
  if (!entry) return { ...MYTHRAS_FALLBACK };
  const { range, ...rest } = entry;
  return { ...rest };
}

const MYTHRAS_TABLE = [
  { range: [1, 3], location: "Right Leg", details: "Includes right hip and thigh", locationIcon: "person-walking", category: "leg", side: "Right " },
  { range: [4, 6], location: "Left Leg", details: "Includes left hip and thigh", locationIcon: "person-walking", category: "leg", side: "Left " },
  { range: [7, 9], location: "Abdomen", details: "Includes groin and lower torso", locationIcon: "vest", category: "torso", side: "" },
  { range: [10, 12], location: "Chest", details: "Includes upper torso and back", locationIcon: "vest", category: "torso", side: "" },
  { range: [13, 15], location: "Right Arm", details: "Includes right shoulder", locationIcon: "hand", category: "arm", side: "Right " },
  { range: [16, 18], location: "Left Arm", details: "Includes left shoulder", locationIcon: "hand", category: "arm", side: "Left " },
  { range: [19, 20], location: "Head", details: "Includes neck", locationIcon: "head-side", category: "head", side: "" },
];

const MYTHRAS_FALLBACK = { location: "Chest", details: "Includes upper torso and back", locationIcon: "vest", category: "torso", side: "" };
