import test from "node:test";
import assert from "node:assert/strict";

import {
  DAMAGE_ROLES,
  buildSourceItemSnapshot,
  buildThresholdAttemptKey,
  calculateThresholdEdge,
  createThresholdMarker,
  getExistingInjuryPressure,
  getHealthPressure,
  getInjuryResistance,
  getThresholdDefense,
  getThresholdSeverityBand,
  getThresholdTargetNumber,
  getTotalSeverityPressure,
  getWeaponPressure,
  isMinimizedSourceSnapshot,
  isThresholdDamageRole,
  thresholdActionFamilyForRole,
  validateThresholdAttackContext,
} from "../../module/helpers/injury-thresholds.mjs";

test("threshold target math combines resistance and edge", () => {
  assert.equal(getThresholdTargetNumber({ injuryResistance: 0, edge: 0 }), 8);
  assert.equal(getThresholdTargetNumber({ injuryResistance: 1, edge: 1 }), 8);
  assert.equal(getThresholdTargetNumber({ injuryResistance: 2, edge: 2 }), 8);
  assert.equal(getThresholdTargetNumber({ injuryResistance: 3, edge: 0 }), 11);
});

test("edge comes from attack margin, with natural 20 as edge 3", () => {
  assert.deepEqual(calculateThresholdEdge({ attackTotal: 14, defense: 14, naturalDie: 9 }), {
    eligible: true,
    edge: 0,
    margin: 0,
    reason: "margin",
  });
  assert.equal(calculateThresholdEdge({ attackTotal: 19, defense: 14, naturalDie: 9 }).edge, 1);
  assert.equal(calculateThresholdEdge({ attackTotal: 24, defense: 14, naturalDie: 9 }).edge, 2);
  assert.equal(calculateThresholdEdge({ attackTotal: 12, defense: 14, naturalDie: 9 }).eligible, false);
  assert.deepEqual(calculateThresholdEdge({ attackTotal: 12, defense: 14, naturalDie: 20 }), {
    eligible: true,
    edge: 3,
    margin: -2,
    reason: "natural20",
  });
});

test("defense lookup uses melee AC only for trusted melee CWN armor attacks", () => {
  const actor = { system: { ac: 14, meleeAc: 16 } };
  assert.equal(getThresholdDefense(actor, { useCWNArmor: false, isMelee: true }), 14);
  assert.equal(getThresholdDefense(actor, { useCWNArmor: true, isMelee: false }), 14);
  assert.equal(getThresholdDefense(actor, { useCWNArmor: true, isMelee: true }), 16);
});

test("injury resistance normalizes missing and invalid values to zero", () => {
  assert.equal(getInjuryResistance({ system: {} }), 0);
  assert.equal(getInjuryResistance({ system: { injuryResistance: "" } }), 0);
  assert.equal(getInjuryResistance({ system: { injuryResistance: -2 } }), 0);
  assert.equal(getInjuryResistance({ system: { injuryResistance: 2.8 } }), 2);
});

test("only validated normal attack action family roles are threshold eligible", () => {
  assert.equal(isThresholdDamageRole(DAMAGE_ROLES.NORMAL), true);
  assert.equal(isThresholdDamageRole(DAMAGE_ROLES.NORMAL_HALF), true);
  assert.equal(isThresholdDamageRole(DAMAGE_ROLES.NORMAL_MODIFIED), true);
  for (const role of [
    DAMAGE_ROLES.CRITICAL,
    DAMAGE_ROLES.SHOCK,
    DAMAGE_ROLES.TRAUMA,
    DAMAGE_ROLES.HEALING,
    DAMAGE_ROLES.PROGRAM,
    DAMAGE_ROLES.POWER,
    DAMAGE_ROLES.REROLL,
    DAMAGE_ROLES.MANUAL,
  ]) {
    assert.equal(isThresholdDamageRole(role), false, role);
  }
});

test("normal, half, and modified damage share one threshold action family", () => {
  assert.equal(thresholdActionFamilyForRole(DAMAGE_ROLES.NORMAL), "normal");
  assert.equal(thresholdActionFamilyForRole(DAMAGE_ROLES.NORMAL_HALF), "normal");
  assert.equal(thresholdActionFamilyForRole(DAMAGE_ROLES.NORMAL_MODIFIED), "normal");
  assert.equal(thresholdActionFamilyForRole(DAMAGE_ROLES.CRITICAL), null);

  const base = { sourceMessageId: "msg1", targetActorId: "actor1", targetTokenId: "token1" };
  assert.equal(
    buildThresholdAttemptKey({ ...base, damageRole: DAMAGE_ROLES.NORMAL }),
    buildThresholdAttemptKey({ ...base, damageRole: DAMAGE_ROLES.NORMAL_HALF })
  );
  assert.equal(
    buildThresholdAttemptKey({ ...base, damageRole: DAMAGE_ROLES.NORMAL }),
    buildThresholdAttemptKey({ ...base, damageRole: DAMAGE_ROLES.NORMAL_MODIFIED })
  );
});

test("weapon, health, and existing injury pressure feed severity with a total cap", () => {
  assert.equal(getWeaponPressure("1d4"), -1);
  assert.equal(getWeaponPressure("1d6"), -1);
  assert.equal(getWeaponPressure("1d8"), 0);
  assert.equal(getWeaponPressure("1d10"), 1);
  assert.equal(getWeaponPressure("1d12"), 1);
  assert.equal(getWeaponPressure("2d6"), 1);
  assert.equal(getWeaponPressure("not dice"), 0);

  assert.equal(getHealthPressure({ preDamageHp: 8, maxHp: 20 }), 1);
  assert.equal(getHealthPressure({ preDamageHp: 5, maxHp: 20 }), 2);
  assert.equal(getExistingInjuryPressure(5), 2);
  assert.equal(getTotalSeverityPressure({ weaponFormula: "2d6", preDamageHp: 5, maxHp: 20, existingInjuries: 5 }), 4);
});

test("severity bands mark only moderate or worse as persistent", () => {
  assert.deepEqual(getThresholdSeverityBand(3), { key: "thresholdMinor", label: "minor", persistent: false });
  assert.deepEqual(getThresholdSeverityBand(5), { key: "thresholdModerate", label: "moderate", persistent: true });
  assert.deepEqual(getThresholdSeverityBand(7), { key: "thresholdSerious", label: "serious", persistent: true });
  assert.deepEqual(getThresholdSeverityBand(8), { key: "thresholdSevere", label: "severe", persistent: true });
});

test("source item snapshots are minimized to threshold allowlist fields", () => {
  const snapshot = buildSourceItemSnapshot({
    name: "Laser Rifle",
    system: {
      damage: "1d10",
      isMelee: false,
      gmNotes: "secret",
      trauma: { rating: 3 },
    },
  });
  assert.deepEqual(snapshot, {
    name: "Laser Rifle",
    baseDamageFormula: "1d10",
    isMelee: false,
    isPersonalScaleWeapon: true,
  });
  assert.equal(isMinimizedSourceSnapshot(snapshot), true);
  assert.equal(isMinimizedSourceSnapshot({ ...snapshot, gmNotes: "secret" }), false);
});

test("threshold context validation fails closed on malformed or overbroad payloads", () => {
  assert.equal(validateThresholdAttackContext({}).valid, false);
  assert.equal(validateThresholdAttackContext({
    v: 1,
    system: "swnr",
    attackTotal: 18,
    naturalDie: 12,
    sourceActorUuid: "Actor.a1",
    sourceItemSnapshot: buildSourceItemSnapshot({ name: "Knife", system: { damage: "1d4", isMelee: true } }),
  }).valid, true);
  assert.deepEqual(validateThresholdAttackContext({
    v: 1,
    system: "swnr",
    attackTotal: 18,
    naturalDie: 12,
    sourceActorUuid: "Actor.a1",
    sourceItemSnapshot: { name: "Knife", baseDamageFormula: "1d4", isMelee: true, secrets: "no" },
  }), { valid: false, reason: "sourceSnapshot" });
});

test("marker payloads are minimal and opaque", () => {
  const marker = createThresholdMarker({ now: () => 123 });
  assert.deepEqual(marker, { v: 1, attempted: true, ts: 123 });
  assert.deepEqual(Object.keys(marker).sort(), ["attempted", "ts", "v"]);
});
