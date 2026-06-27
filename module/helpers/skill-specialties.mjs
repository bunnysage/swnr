/**
 * Skill specialty families (Banshee Prime house rule).
 *
 * Pure data + lookup, deliberately free of Foundry globals so it can be unit-tested under
 * `node --test`. Keyed by skill key (matching CONFIG.SWN.skills entries). Only the Banshee
 * preset uses the `marksmanship` / `melee` / `tech` keys, so only that preset's skills get
 * available families; revised/classic/cwn use different keys and stay specialty-free.
 */
export const SKILL_SPECIALTY_FAMILIES = {
  marksmanship: [
    "Sidearms",
    "Longarms",
    "Heavy",
    "Energy Weapons",
    "Primitive Ranged",
  ],
  melee: [
    "Blades",
    "Bludgeons",
    "Polearms & Spears",
    "Flexible",
    "Improvised & Exotic",
  ],
  tech: [
    "Postech",
    "Pretech",
    "Astronautic",
    "Maltech",
    "Psitech",
  ],
};

/**
 * Available specialty families for a skill key, or an empty array when the skill has none.
 * @param {string} skillKey
 * @returns {string[]}
 */
export function getAvailableSpecialties(skillKey) {
  const families = SKILL_SPECIALTY_FAMILIES[skillKey];
  return Array.isArray(families) ? [...families] : [];
}
