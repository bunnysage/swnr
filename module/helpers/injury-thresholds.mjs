import { DAMAGE_ROLES } from "./damage-roles.mjs";

export const THRESHOLD_ATTACK_FLAG_VERSION = 1;
export const THRESHOLD_MARKER_FLAG_VERSION = 1;
export const THRESHOLD_ATTACK_KIND = "weaponAttack";
export const THRESHOLD_MARKER_LIMIT = 100;
export { DAMAGE_ROLES };

export const THRESHOLD_ACTION_FAMILY = "normal";
const THRESHOLD_ROLES = new Set([
  DAMAGE_ROLES.NORMAL,
  DAMAGE_ROLES.NORMAL_HALF,
  DAMAGE_ROLES.NORMAL_MODIFIED,
]);

export function normalizeNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

export function getInjuryResistance(actorOrSystem) {
  const system = actorOrSystem?.system ?? actorOrSystem ?? {};
  return normalizeNonNegativeInteger(system.injuryResistance);
}

export function getThresholdDefense(actor, { useCWNArmor = false, isMelee = false } = {}) {
  const system = actor?.system ?? {};
  if (useCWNArmor && isMelee) return normalizeNonNegativeInteger(system.meleeAc);
  return normalizeNonNegativeInteger(system.ac);
}

export function calculateThresholdEdge({ attackTotal, defense, naturalDie }) {
  if (Number(naturalDie) === 20) {
    return { eligible: true, edge: 3, margin: Number(attackTotal) - Number(defense), reason: "natural20" };
  }

  const margin = Number(attackTotal) - Number(defense);
  if (!Number.isFinite(margin) || margin < 0) {
    return { eligible: false, edge: 0, margin, reason: "miss" };
  }

  if (margin >= 10) return { eligible: true, edge: 2, margin, reason: "margin" };
  if (margin >= 5) return { eligible: true, edge: 1, margin, reason: "margin" };
  return { eligible: true, edge: 0, margin, reason: "margin" };
}

export function getThresholdTargetNumber({ injuryResistance = 0, edge = 0 } = {}) {
  return 8 + normalizeNonNegativeInteger(injuryResistance) - normalizeNonNegativeInteger(edge);
}

export function isThresholdTriggered({ dieTotal, targetNumber }) {
  return Number(dieTotal) >= Number(targetNumber);
}

export function isThresholdDamageRole(role) {
  return THRESHOLD_ROLES.has(role);
}

export function thresholdActionFamilyForRole(role) {
  return isThresholdDamageRole(role) ? THRESHOLD_ACTION_FAMILY : null;
}

export function getWeaponPressure(formula) {
  const dice = String(formula ?? "").match(/(\d*)d(\d+)/gi) ?? [];
  if (!dice.length) return 0;

  let heaviest = 0;
  let diceCount = 0;
  for (const die of dice) {
    const [, countText, sidesText] = die.match(/(\d*)d(\d+)/i) ?? [];
    const count = countText === "" ? 1 : Number(countText);
    const sides = Number(sidesText);
    if (!Number.isFinite(count) || !Number.isFinite(sides)) continue;
    diceCount += count;
    heaviest = Math.max(heaviest, sides);
  }

  if (diceCount >= 2 && heaviest >= 6) return 1;
  if (heaviest <= 6) return -1;
  if (heaviest <= 8) return 0;
  return 1;
}

export function getHealthPressure({ preDamageHp, maxHp }) {
  const hp = Number(preDamageHp);
  const max = Number(maxHp);
  if (!Number.isFinite(hp) || !Number.isFinite(max) || max <= 0) return 0;
  if (hp <= max * 0.25) return 2;
  if (hp <= max * 0.5) return 1;
  return 0;
}

export function getExistingInjuryPressure(injuries) {
  return Math.min(2, normalizeNonNegativeInteger(injuries));
}

export function getTotalSeverityPressure({ weaponFormula, preDamageHp, maxHp, existingInjuries } = {}) {
  const pressure = getWeaponPressure(weaponFormula) +
    getHealthPressure({ preDamageHp, maxHp }) +
    getExistingInjuryPressure(existingInjuries);
  return Math.min(4, pressure);
}

export function getThresholdSeverityBand(score) {
  const severityScore = Number(score);
  if (severityScore <= 3) return { key: "thresholdMinor", label: "minor", persistent: false };
  if (severityScore <= 5) return { key: "thresholdModerate", label: "moderate", persistent: true };
  if (severityScore <= 7) return { key: "thresholdSerious", label: "serious", persistent: true };
  return { key: "thresholdSevere", label: "severe", persistent: true };
}

export function buildThresholdAttemptKey({
  sourceMessageId,
  sourceMessageUuid,
  targetActorId,
  targetActorUuid,
  targetTokenId,
  targetTokenUuid,
  damageRole,
  actionFamily,
} = {}) {
  const messageKey = sourceMessageId || sourceMessageUuid || "unknown-message";
  const actorKey = targetActorId || targetActorUuid || "unknown-actor";
  const tokenKey = targetTokenId || targetTokenUuid || "actor";
  const family = actionFamily || thresholdActionFamilyForRole(damageRole) || "none";
  return `v${THRESHOLD_MARKER_FLAG_VERSION}:${hashMarkerTuple(`${messageKey}:${family}:${actorKey}:${tokenKey}`)}`;
}

export function createThresholdMarker({ now = Date.now } = {}) {
  const timestamp = typeof now === "function" ? now() : now;
  return {
    v: THRESHOLD_MARKER_FLAG_VERSION,
    attempted: true,
    ts: timestamp,
  };
}

export function hashMarkerTuple(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value ?? "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function pruneThresholdMarkers(markers = {}, { limit = THRESHOLD_MARKER_LIMIT } = {}) {
  const entries = Object.entries(markers);
  if (entries.length <= limit) return markers;
  return Object.fromEntries(entries
    .sort(([, left], [, right]) => Number(right?.ts ?? 0) - Number(left?.ts ?? 0))
    .slice(0, limit));
}

export function buildSourceItemSnapshot(itemOrSystem = {}) {
  const system = itemOrSystem.system ?? itemOrSystem;
  return {
    name: String(itemOrSystem.name ?? ""),
    baseDamageFormula: String(system.damage ?? system.baseDamageFormula ?? ""),
    isMelee: Boolean(system.isMelee),
    isPersonalScaleWeapon: system.isPersonalScaleWeapon ?? true,
  };
}

export function isMinimizedSourceSnapshot(snapshot = {}) {
  const allowed = new Set(["name", "baseDamageFormula", "isMelee", "isPersonalScaleWeapon"]);
  return Object.keys(snapshot).every((key) => allowed.has(key));
}

export function validateThresholdAttackContext(context = {}) {
  if (context.v !== THRESHOLD_ATTACK_FLAG_VERSION) return { valid: false, reason: "version" };
  if (context.system !== "swnr") return { valid: false, reason: "system" };
  if (context.kind !== THRESHOLD_ATTACK_KIND) return { valid: false, reason: "kind" };
  if (!Number.isFinite(Number(context.attackTotal))) return { valid: false, reason: "attackTotal" };
  if (!Number.isFinite(Number(context.naturalDie))) return { valid: false, reason: "naturalDie" };
  if (!context.sourceActorUuid && !context.sourceActorId) return { valid: false, reason: "sourceActor" };
  if (!context.sourceItemUuid && !context.sourceItemId && !context.sourceItemSnapshot) return { valid: false, reason: "sourceItem" };
  if (context.sourceItemSnapshot && !isMinimizedSourceSnapshot(context.sourceItemSnapshot)) {
    return { valid: false, reason: "sourceSnapshot" };
  }
  return { valid: true, reason: null };
}
