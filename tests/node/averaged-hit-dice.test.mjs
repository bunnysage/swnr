import test from "node:test";
import assert from "node:assert/strict";

import {
  averageHitDie,
  AVERAGED_HIT_DIE_MAP,
} from "../../module/helpers/averaged-hit-dice.mjs";

test("each supported single die splits into two half-sized dice (R3)", () => {
  const cases = [
    ["d4", "2d2"],
    ["d6", "2d3"],
    ["d8", "2d4"],
    ["d10", "2d5"],
    ["d12", "2d6"],
  ];
  for (const [input, expected] of cases) {
    const result = averageHitDie(input);
    assert.equal(result.status, "transformed", `${input} should transform`);
    assert.equal(result.formula, expected);
  }
});

test("multi-die hit dice multiply the count by two (R5)", () => {
  assert.equal(averageHitDie("3d8").formula, "6d4");
  assert.equal(averageHitDie("2d6").formula, "4d3");
  assert.equal(averageHitDie("1d10").formula, "2d5");
});

test("a bare die is treated as a single die (R3)", () => {
  assert.equal(averageHitDie("d8").formula, "2d4");
});

test("unsupported die sizes are left unchanged and flagged (R7)", () => {
  for (const input of ["d20", "d3", "d100", "d7", "5d20"]) {
    const result = averageHitDie(input);
    assert.equal(result.status, "unsupported", `${input} should be unsupported`);
    assert.equal(result.formula, input);
    assert.equal(result.label, null);
  }
});

test("non-dice strings are returned untouched with no transform (R8)", () => {
  for (const input of ["15", "0", "", "15 HP", "abc"]) {
    const result = averageHitDie(input);
    assert.equal(result.status, "not-a-die", `${input} should be not-a-die`);
    assert.equal(result.formula, input);
    assert.equal(result.label, null);
  }
});

test("null and undefined do not throw and report not-a-die", () => {
  for (const input of [null, undefined]) {
    const result = averageHitDie(input);
    assert.equal(result.status, "not-a-die");
    assert.equal(result.formula, "");
  }
});

test("transformed result carries an open flavor label naming the source die (R9)", () => {
  assert.equal(averageHitDie("d6").label, "2d3 (averaged d6)");
  assert.equal(averageHitDie("3d8").label, "6d4 (averaged 3d8)");
});

test("parsing is case-insensitive", () => {
  assert.equal(averageHitDie("3D8").formula, "6d4");
  assert.equal(averageHitDie("D6").formula, "2d3");
});

test("the supported map covers exactly d4/d6/d8/d10/d12", () => {
  assert.deepEqual(
    Object.keys(AVERAGED_HIT_DIE_MAP).map(Number).sort((a, b) => a - b),
    [4, 6, 8, 10, 12],
  );
});
