import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateFeatureBonuses,
  createEmptyFeatureBonuses,
} from "../../module/helpers/feature-bonuses.mjs";

// A formula evaluator that mimics Foundry Roll: supports ceil()/floor() and a
// single @lvl substitution, so tests can exercise the real formula shape used
// by the Killing Blow content ("ceil(@lvl/2)") without a live Foundry.
function makeEvaluator(rollData = {}) {
  return (formula) => {
    if (formula === undefined || formula === null || formula === "") return 0;
    const expr = String(formula)
      .replace(/@lvl/g, String(rollData.lvl ?? 0))
      .replace(/ceil/g, "Math.ceil")
      .replace(/floor/g, "Math.floor");
    // eslint-disable-next-line no-new-func
    return new Function("Math", `return (${expr});`)(Math);
  };
}

const allTrue = () => true;

test("ceil(@lvl/2) on allDamage with appliesToShock matches Aldric (AE1)", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "allDamage", formula: "ceil(@lvl/2)", appliesToShock: true, condition: "" }],
    { evaluateFormula: makeEvaluator({ lvl: 2 }), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, { meleeDamage: 1, rangedDamage: 1, shock: 1, attack: 0 });
});

test("allDamage fans out to both melee and ranged, not shock", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "allDamage", formula: "2" }],
    { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, { meleeDamage: 2, rangedDamage: 2, shock: 0, attack: 0 });
});

test("appliesToShock adds to shock on top of the primary target", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "meleeDamage", formula: "3", appliesToShock: true }],
    { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, { meleeDamage: 3, rangedDamage: 0, shock: 3, attack: 0 });
});

test("appliesToShock is a no-op when target is already shock (no double count)", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "shock", formula: "1", appliesToShock: true }],
    { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, { meleeDamage: 0, rangedDamage: 0, shock: 1, attack: 0 });
});

test("condition gating skips an entry when the condition is false", () => {
  // Conditions use the poolsGranted dialect (@level), not the formula's @lvl.
  const totals = aggregateFeatureBonuses(
    [{ target: "allDamage", formula: "5", condition: "@level >= 3" }],
    { evaluateFormula: makeEvaluator({ lvl: 2 }), evaluateCondition: () => false }
  );
  assert.deepEqual(totals, createEmptyFeatureBonuses());
});

test("a satisfied condition lets the entry through", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "attack", formula: "1", condition: "@level >= 1" }],
    { evaluateFormula: makeEvaluator({ lvl: 2 }), evaluateCondition: () => true }
  );
  assert.deepEqual(totals, { meleeDamage: 0, rangedDamage: 0, shock: 0, attack: 1 });
});

test("mixed true/false conditions gate per entry", () => {
  const totals = aggregateFeatureBonuses(
    [
      { target: "meleeDamage", formula: "2", condition: "off" },
      { target: "rangedDamage", formula: "3", condition: "on" },
    ],
    { evaluateFormula: makeEvaluator(), evaluateCondition: (c) => c === "on" }
  );
  assert.deepEqual(totals, { meleeDamage: 0, rangedDamage: 3, shock: 0, attack: 0 });
});

test("multiple entries accumulate across features", () => {
  const totals = aggregateFeatureBonuses(
    [
      { target: "allDamage", formula: "1" },
      { target: "allDamage", formula: "2" },
    ],
    { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, { meleeDamage: 3, rangedDamage: 3, shock: 0, attack: 0 });
});

test("empty / missing input yields a zeroed total", () => {
  assert.deepEqual(
    aggregateFeatureBonuses([], { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }),
    createEmptyFeatureBonuses()
  );
  assert.deepEqual(aggregateFeatureBonuses(undefined), createEmptyFeatureBonuses());
});

test("non-finite formula results are treated as zero", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "allDamage", formula: "garbage" }],
    { evaluateFormula: () => NaN, evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, createEmptyFeatureBonuses());
});

test("rangedDamage + appliesToShock is symmetric with the melee case", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "rangedDamage", formula: "3", appliesToShock: true }],
    { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, { meleeDamage: 0, rangedDamage: 3, shock: 3, attack: 0 });
});

test("an unknown target contributes nothing, even with appliesToShock", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "notAThing", formula: "2", appliesToShock: true }],
    { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, createEmptyFeatureBonuses());
});

test("a zero-value entry adds nothing, including its appliesToShock side", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "allDamage", formula: "ceil(@lvl/2)", appliesToShock: true }],
    { evaluateFormula: makeEvaluator({ lvl: 0 }), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, createEmptyFeatureBonuses());
});

test("negative formula results pass through as penalties (no clamp)", () => {
  const totals = aggregateFeatureBonuses(
    [{ target: "allDamage", formula: "-1" }],
    { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, { meleeDamage: -1, rangedDamage: -1, shock: 0, attack: 0 });
});

test("entries route into all four buckets independently", () => {
  const totals = aggregateFeatureBonuses(
    [
      { target: "meleeDamage", formula: "1" },
      { target: "rangedDamage", formula: "2" },
      { target: "shock", formula: "3" },
      { target: "attack", formula: "4" },
    ],
    { evaluateFormula: makeEvaluator(), evaluateCondition: allTrue }
  );
  assert.deepEqual(totals, { meleeDamage: 1, rangedDamage: 2, shock: 3, attack: 4 });
});
