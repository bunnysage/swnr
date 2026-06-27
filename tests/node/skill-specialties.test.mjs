import test from "node:test";
import assert from "node:assert/strict";

import {
  SKILL_SPECIALTY_FAMILIES,
  getAvailableSpecialties,
} from "../../module/helpers/skill-specialties.mjs";

test("only Marksmanship, Melee, and Tech declare specialty families", () => {
  assert.deepEqual(Object.keys(SKILL_SPECIALTY_FAMILIES).sort(), [
    "marksmanship",
    "melee",
    "tech",
  ]);
});

test("family lists match the house rules exactly (names and order)", () => {
  assert.deepEqual(getAvailableSpecialties("marksmanship"), [
    "Sidearms",
    "Longarms",
    "Heavy",
    "Energy Weapons",
    "Primitive Ranged",
  ]);
  assert.deepEqual(getAvailableSpecialties("melee"), [
    "Blades",
    "Bludgeons",
    "Polearms & Spears",
    "Flexible",
    "Improvised & Exotic",
  ]);
  assert.deepEqual(getAvailableSpecialties("tech"), [
    "Postech",
    "Pretech",
    "Astronautic",
    "Maltech",
    "Psitech",
  ]);
});

test("non-specialty skill keys return an empty list", () => {
  for (const key of ["shoot", "stab", "fix", "notice", "administer", "security"]) {
    assert.deepEqual(getAvailableSpecialties(key), [], key);
  }
});

test("getAvailableSpecialties returns a fresh copy (callers cannot mutate the source)", () => {
  const families = getAvailableSpecialties("tech");
  families.push("Bogus");
  assert.equal(getAvailableSpecialties("tech").includes("Bogus"), false);
});
