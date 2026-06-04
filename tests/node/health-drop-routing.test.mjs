import test from "node:test";
import assert from "node:assert/strict";

import { DAMAGE_ROLES, THRESHOLD_ATTACK_KIND } from "../../module/helpers/injury-thresholds.mjs";
import { applyHealthDrop, shouldApplyAboveZeroCriticalInjury } from "../../module/helpers/chat.mjs";

test("above-zero critical injuries are limited to normal attack damage roles", () => {
  globalThis.game = { settings: { get: () => false } };

  assert.equal(shouldApplyAboveZeroCriticalInjury({
    isCriticalHit: true,
    damageRole: DAMAGE_ROLES.NORMAL,
  }), true);
  assert.equal(shouldApplyAboveZeroCriticalInjury({
    isCriticalHit: true,
    damageRole: DAMAGE_ROLES.NORMAL_HALF,
  }), true);
  assert.equal(shouldApplyAboveZeroCriticalInjury({
    isCriticalHit: true,
    damageRole: DAMAGE_ROLES.SHOCK,
  }), false);
  assert.equal(shouldApplyAboveZeroCriticalInjury({
    isCriticalHit: true,
    damageRole: DAMAGE_ROLES.TRAUMA,
  }), false);
  assert.equal(shouldApplyAboveZeroCriticalInjury({
    isCriticalHit: true,
    damageRole: DAMAGE_ROLES.CRITICAL,
  }), false);
});

test("threshold routing suppresses above-zero critical injury for normal attack roles", () => {
  globalThis.game = { settings: { get: (_namespace, key) => key === "useThresholdInjuries" } };

  assert.equal(shouldApplyAboveZeroCriticalInjury({
    isCriticalHit: true,
    damageRole: DAMAGE_ROLES.NORMAL,
    thresholdContext: { attack: {} },
  }), false);
});

test("health drop routing gives each selected target its own damage copy", async () => {
  globalThis.CONST = { TEXT_ANCHOR_POINTS: { CENTER: 0, BOTTOM: 1, TOP: 2 } };
  globalThis.CONFIG = { statusEffects: [], specialStatusEffects: {}, controlIcons: {} };
  globalThis.game = {
    release: { generation: 10 },
    user: { isGM: true },
    settings: { get: (_namespace, key) => key === "useCWNArmor" || key === "useDeathAndDismemberment" ? false : null },
  };

  function actor(id, dr = 0) {
    return {
      id,
      type: "character",
      system: { health: { value: 10, max: 10 } },
      items: dr ? [{ type: "armor", system: { use: true, location: "readied", dr } }] : [],
      async update(changes) {
        if (Object.hasOwn(changes, "system.health.value")) this.system.health.value = changes["system.health.value"];
      },
    };
  }

  const first = actor("first", 3);
  const second = actor("second");
  globalThis.canvas = {
    interface: { createScrollingText: () => {} },
    tokens: {
      controlled: [
        { id: "t1", actor: first, center: {}, name: "First" },
        { id: "t2", actor: second, center: {}, name: "Second" },
      ],
    },
  };

  const outcomes = await applyHealthDrop(5, { damageRole: DAMAGE_ROLES.MANUAL });
  assert.equal(first.system.health.value, 8);
  assert.equal(second.system.health.value, 5);
  assert.deepEqual(outcomes.map((outcome) => outcome.hpApplied), [2, 5]);
});

test("missed threshold attacks do not claim idempotency markers", async () => {
  globalThis.CONST = { TEXT_ANCHOR_POINTS: { CENTER: 0, BOTTOM: 1, TOP: 2 } };
  globalThis.CONFIG = { statusEffects: [], specialStatusEffects: {}, controlIcons: {} };
  const sourceActor = { id: "source", uuid: "Actor.source", type: "character" };
  globalThis.fromUuid = async (uuid) => uuid === sourceActor.uuid ? sourceActor : null;
  globalThis.ChatMessage = { create: async () => {}, getSpeaker: () => ({}) };
  globalThis.game = {
    release: { generation: 10 },
    user: { isGM: true },
    users: [],
    actors: { get: () => null },
    settings: {
      get: (_namespace, key) => key === "useThresholdInjuries",
    },
  };

  let claimCount = 0;
  const target = {
    id: "target",
    uuid: "Actor.target",
    type: "character",
    system: { ac: 14, meleeAc: 14, health: { value: 10, max: 10 } },
    items: [],
    async update(changes) {
      if (Object.hasOwn(changes, "system.health.value")) this.system.health.value = changes["system.health.value"];
    },
    getThresholdAttemptMarker: () => null,
    claimThresholdAttempt: async () => {
      claimCount += 1;
      return true;
    },
  };

  globalThis.canvas = {
    interface: { createScrollingText: () => {} },
    tokens: {
      controlled: [{ id: "token", actor: target, center: {}, name: "Target", document: { uuid: "Scene.s.Token.t" } }],
    },
  };

  const outcomes = await applyHealthDrop(3, {
    damageRole: DAMAGE_ROLES.NORMAL,
    thresholdContext: {
      sourceMessageId: "msg1",
      sourceMessageUuid: "ChatMessage.msg1",
      message: { speaker: { actor: "source" } },
      damageRole: DAMAGE_ROLES.NORMAL,
      attack: {
        v: 1,
        system: "swnr",
        kind: THRESHOLD_ATTACK_KIND,
        attackTotal: 10,
        naturalDie: 9,
        sourceActorId: "source",
        sourceActorUuid: sourceActor.uuid,
        sourceItemSnapshot: { name: "Rifle", baseDamageFormula: "1d10", isMelee: false, isPersonalScaleWeapon: true },
        isPersonalScaleWeapon: true,
      },
    },
  });

  assert.equal(claimCount, 0);
  assert.equal(outcomes[0].thresholdSkippedReason, "miss");
});

test("threshold-aware health application emits compact GM summary", async () => {
  globalThis.CONST = { TEXT_ANCHOR_POINTS: { CENTER: 0, BOTTOM: 1, TOP: 2 } };
  globalThis.CONFIG = { statusEffects: [], specialStatusEffects: {}, controlIcons: {} };
  const sourceActor = { id: "source", uuid: "Actor.source", type: "character" };
  globalThis.fromUuid = async (uuid) => uuid === sourceActor.uuid ? sourceActor : null;
  const createdMessages = [];
  globalThis.ChatMessage = {
    create: async (data) => {
      createdMessages.push(data);
      return data;
    },
    getSpeaker: () => ({}),
  };
  globalThis.game = {
    release: { generation: 10 },
    user: { id: "gm", isGM: true },
    users: [{ id: "gm", isGM: true }],
    actors: { get: () => null },
    settings: {
      get: (_namespace, key) => key === "useThresholdInjuries",
    },
  };

  let marker = null;
  const target = {
    id: "target",
    uuid: "Actor.target",
    type: "character",
    system: { ac: 10, meleeAc: 10, health: { value: 10, max: 10 } },
    items: [],
    async update(changes) {
      if (Object.hasOwn(changes, "system.health.value")) this.system.health.value = changes["system.health.value"];
    },
    getThresholdAttemptMarker: () => marker,
    claimThresholdAttempt: async () => {
      marker = { attempted: true };
      return true;
    },
    applyThresholdInjury: async () => ({
      thresholdEligible: true,
      thresholdAttempted: true,
      thresholdTriggered: false,
      thresholdRoll: 4,
      targetNumber: 8,
      edge: 0,
      injuryResistance: 0,
      defense: 10,
    }),
  };

  globalThis.canvas = {
    interface: { createScrollingText: () => {} },
    tokens: {
      controlled: [{ id: "token", actor: target, center: {}, name: "Target", document: { uuid: "Scene.s.Token.t" } }],
    },
  };

  const outcomes = await applyHealthDrop(3, {
    damageRole: DAMAGE_ROLES.NORMAL,
    thresholdContext: {
      sourceMessageId: "msg1",
      sourceMessageUuid: "ChatMessage.msg1",
      message: { speaker: { actor: "source" } },
      damageRole: DAMAGE_ROLES.NORMAL,
      attack: {
        v: 1,
        system: "swnr",
        kind: THRESHOLD_ATTACK_KIND,
        attackTotal: 10,
        naturalDie: 10,
        sourceActorId: "source",
        sourceActorUuid: sourceActor.uuid,
        sourceItemSnapshot: { name: "Rifle", baseDamageFormula: "1d10", isMelee: false, isPersonalScaleWeapon: true },
        isPersonalScaleWeapon: true,
      },
    },
  });

  assert.equal(outcomes[0].thresholdAttempted, true);
  assert.equal(createdMessages.length, 1);
  assert.match(createdMessages[0].content, /Threshold injury summary/);
  assert.match(createdMessages[0].content, /<th>HP<\/th>/);
  assert.match(createdMessages[0].content, /4 vs 8/);
  assert.match(createdMessages[0].content, /no trigger/);
  assert.deepEqual(createdMessages[0].whisper, ["gm"]);
});

test("below-zero death and dismemberment preempts threshold injury", async () => {
  globalThis.CONST = { TEXT_ANCHOR_POINTS: { CENTER: 0, BOTTOM: 1, TOP: 2 } };
  globalThis.CONFIG = { statusEffects: [], specialStatusEffects: {}, controlIcons: {} };
  const sourceActor = { id: "source", uuid: "Actor.source", type: "character" };
  globalThis.fromUuid = async (uuid) => uuid === sourceActor.uuid ? sourceActor : null;
  const createdMessages = [];
  globalThis.ChatMessage = {
    create: async (data) => {
      createdMessages.push(data);
      return data;
    },
    getSpeaker: () => ({}),
  };
  globalThis.game = {
    release: { generation: 10 },
    user: { id: "gm", isGM: true },
    users: [{ id: "gm", isGM: true }],
    actors: { get: () => null },
    settings: {
      get: (_namespace, key) => key === "useThresholdInjuries" || key === "useDeathAndDismemberment",
    },
  };

  let woundsApplied = 0;
  let thresholdCalled = false;
  const target = {
    id: "target",
    uuid: "Actor.target",
    type: "character",
    system: { ac: 10, meleeAc: 10, health: { value: 2, max: 10 } },
    items: [],
    async update(changes) {
      if (Object.hasOwn(changes, "system.health.value")) this.system.health.value = changes["system.health.value"];
    },
    async applyWounds() {
      woundsApplied += 1;
    },
    getThresholdAttemptMarker: () => null,
    claimThresholdAttempt: async () => {
      thresholdCalled = true;
      return true;
    },
  };

  globalThis.canvas = {
    interface: { createScrollingText: () => {} },
    tokens: {
      controlled: [{ id: "token", actor: target, center: {}, name: "Target", document: { uuid: "Scene.s.Token.t" } }],
    },
  };

  const outcomes = await applyHealthDrop(5, {
    damageRole: DAMAGE_ROLES.NORMAL,
    thresholdContext: {
      sourceMessageId: "msg1",
      sourceMessageUuid: "ChatMessage.msg1",
      message: { speaker: { actor: "source" } },
      damageRole: DAMAGE_ROLES.NORMAL,
      attack: {
        v: 1,
        system: "swnr",
        kind: THRESHOLD_ATTACK_KIND,
        attackTotal: 18,
        naturalDie: 12,
        sourceActorId: "source",
        sourceActorUuid: sourceActor.uuid,
        sourceItemSnapshot: { name: "Rifle", baseDamageFormula: "1d10", isMelee: false, isPersonalScaleWeapon: true },
        isPersonalScaleWeapon: true,
      },
    },
  });

  assert.equal(woundsApplied, 1);
  assert.equal(thresholdCalled, false);
  assert.equal(outcomes[0].woundApplied, true);
  assert.equal(outcomes[0].thresholdSkippedReason, "below-zero-preemption");
  assert.match(createdMessages.at(-1).content, /below-zero-preemption/);
});
