import test from "node:test";
import assert from "node:assert/strict";

import { DAMAGE_ROLES } from "../../module/helpers/injury-thresholds.mjs";
import { shouldApplyAboveZeroCriticalInjury } from "../../module/helpers/chat.mjs";

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
