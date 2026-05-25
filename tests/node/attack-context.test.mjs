import test from "node:test";
import assert from "node:assert/strict";

import {
  DAMAGE_ROLES,
  buildSourceItemSnapshot,
  isThresholdDamageRole,
  validateThresholdAttackContext,
} from "../../module/helpers/injury-thresholds.mjs";
import { validateThresholdProvenance } from "../../module/helpers/chat.mjs";

test(".roll-damage alone cannot identify threshold eligibility", () => {
  const renderedDamageRoles = [
    DAMAGE_ROLES.NORMAL,
    DAMAGE_ROLES.CRITICAL,
    DAMAGE_ROLES.SHOCK,
    DAMAGE_ROLES.TRAUMA,
  ];

  assert.deepEqual(renderedDamageRoles.map((role) => isThresholdDamageRole(role)), [
    true,
    false,
    false,
    false,
  ]);
});

test("valid threshold context stores attack total separately from natural die", () => {
  const context = {
    v: 1,
    system: "swnr",
    attackTotal: 27,
    naturalDie: 20,
    sourceActorUuid: "Actor.pc",
    sourceItemUuid: "Actor.pc.Item.rifle",
    sourceItemSnapshot: buildSourceItemSnapshot({
      name: "Rifle",
      system: { damage: "1d10", isMelee: false },
    }),
  };

  assert.equal(validateThresholdAttackContext(context).valid, true);
  assert.notEqual(context.attackTotal, context.naturalDie);
});

test("threshold provenance validates source actor, item, author, and hit roll", async () => {
  const author = { id: "u1", isGM: false };
  const actor = {
    id: "pc",
    uuid: "Actor.pc",
    type: "character",
    getEmbeddedDocument: () => item,
    testUserPermission: (user, permission) => user.id === "u1" && permission === "OWNER",
  };
  const item = { id: "rifle", uuid: "Actor.pc.Item.rifle", parent: actor };
  const message = {
    speaker: { actor: "pc" },
    user: "u1",
    rolls: [{ total: 27, dice: [{ total: 20 }] }],
  };
  const uuidMap = new Map([
    [actor.uuid, actor],
    [item.uuid, item],
  ]);
  globalThis.fromUuid = async (uuid) => uuidMap.get(uuid) ?? null;
  globalThis.game = {
    user: { isGM: false },
    actors: { get: (id) => id === actor.id ? actor : null },
    users: { get: (id) => id === author.id ? author : null },
    settings: { get: () => false },
  };

  const attack = {
    v: 1,
    system: "swnr",
    attackTotal: 27,
    naturalDie: 20,
    sourceActorId: "pc",
    sourceActorUuid: actor.uuid,
    sourceItemId: "rifle",
    sourceItemUuid: item.uuid,
    sourceItemSnapshot: buildSourceItemSnapshot({
      name: "Rifle",
      system: { damage: "1d10", isMelee: false },
    }),
    isPersonalScaleWeapon: true,
    authorUserId: "u1",
  };

  assert.deepEqual(await validateThresholdProvenance({ attack, message, damageRole: DAMAGE_ROLES.NORMAL }), { valid: true, reason: null });
  assert.equal((await validateThresholdProvenance({ attack, message, damageRole: DAMAGE_ROLES.SHOCK })).reason, "damage-role");
  assert.equal((await validateThresholdProvenance({ attack, message: { ...message, speaker: { actor: "other" } }, damageRole: DAMAGE_ROLES.NORMAL })).reason, "speaker-mismatch");
  assert.equal((await validateThresholdProvenance({ attack: { ...attack, attackTotal: 19 }, message, damageRole: DAMAGE_ROLES.NORMAL })).reason, "attack-total-mismatch");
  assert.equal((await validateThresholdProvenance({
    attack: { ...attack, isPersonalScaleWeapon: false },
    message,
    damageRole: DAMAGE_ROLES.NORMAL,
  })).reason, "source-scale");

  const vehicleActor = { ...actor, type: "vehicle" };
  uuidMap.set(actor.uuid, vehicleActor);
  assert.equal((await validateThresholdProvenance({ attack, message, damageRole: DAMAGE_ROLES.NORMAL })).reason, "source-actor-type");
});
