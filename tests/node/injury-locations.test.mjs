import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveThresholdLocation,
  resolveMythrasLocation,
} from "../../module/helpers/injury-locations.mjs";

test("threshold 1d12 table maps each band, with limbs needing a side roll", () => {
  for (const r of [1, 2]) assert.deepEqual(resolveThresholdLocation(r), { location: "arm", locationIcon: "hand", needsSide: true });
  for (const r of [3, 4]) assert.deepEqual(resolveThresholdLocation(r), { location: "leg", locationIcon: "person-walking", needsSide: true });
  for (const r of [5, 9]) assert.deepEqual(resolveThresholdLocation(r), { location: "torso", locationIcon: "vest", needsSide: false });
  for (const r of [10, 12]) assert.deepEqual(resolveThresholdLocation(r), { location: "head", locationIcon: "head-side", needsSide: false });
});

test("Mythras 1d20 table maps every range boundary", () => {
  const expect = (loc, cat, side) => ({ loc, cat, side });
  const cases = [
    [1, expect("Right Leg", "leg", "Right ")], [3, expect("Right Leg", "leg", "Right ")],
    [4, expect("Left Leg", "leg", "Left ")], [6, expect("Left Leg", "leg", "Left ")],
    [7, expect("Abdomen", "torso", "")], [9, expect("Abdomen", "torso", "")],
    [10, expect("Chest", "torso", "")], [12, expect("Chest", "torso", "")],
    [13, expect("Right Arm", "arm", "Right ")], [15, expect("Right Arm", "arm", "Right ")],
    [16, expect("Left Arm", "arm", "Left ")], [18, expect("Left Arm", "arm", "Left ")],
    [19, expect("Head", "head", "")], [20, expect("Head", "head", "")],
  ];
  for (const [roll, e] of cases) {
    const got = resolveMythrasLocation(roll);
    assert.equal(got.location, e.loc, `roll ${roll} location`);
    assert.equal(got.category, e.cat, `roll ${roll} category`);
    assert.equal(got.side, e.side, `roll ${roll} side`);
    assert.equal(typeof got.details, "string");
    assert.ok(got.details.length > 0);
  }
});

test("Mythras side prefix matches the effect-bucket category", () => {
  // limbs carry a Left/Right prefix; torso/head do not
  assert.equal(resolveMythrasLocation(1).side.trim().length > 0, true);
  assert.equal(resolveMythrasLocation(7).side, "");
  assert.equal(resolveMythrasLocation(20).side, "");
});

test("out-of-range / non-numeric input falls back to a defined location, no throw", () => {
  for (const bad of [0, 21, -5, NaN, undefined, "x"]) {
    const got = resolveMythrasLocation(bad);
    assert.equal(typeof got.location, "string");
    assert.equal(typeof got.category, "string");
    assert.ok(["arm", "leg", "torso", "head"].includes(got.category));
  }
  // threshold resolver also tolerates junk (returns the head/torso tail)
  assert.equal(typeof resolveThresholdLocation(NaN).location, "string");
});
