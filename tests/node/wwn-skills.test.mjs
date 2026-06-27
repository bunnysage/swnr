import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { SWN } from "../../module/helpers/config.mjs";

const en = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../lang/en.json", import.meta.url)), "utf8")
);

const EXPECTED_WWN_SKILLS = [
  "administer", "alchemy", "connect", "convince", "craft", "exert", "heal",
  "know", "lead", "magic", "notice", "perform", "pray", "punch", "ride",
  "sail", "shoot", "sneak", "stab", "steal", "survive", "trade", "work",
];

test("wwn skill set contains exactly the 23 expected keys", () => {
  assert.ok(SWN.skills.wwn, "CONFIG.SWN.skills.wwn is defined");
  assert.deepEqual(
    [...SWN.skills.wwn].sort(),
    [...EXPECTED_WWN_SKILLS].sort()
  );
});

test("wwn set adds steal and alchemy over the WWN core", () => {
  assert.ok(SWN.skills.wwn.includes("steal"), "steal present");
  assert.ok(SWN.skills.wwn.includes("alchemy"), "alchemy present");
});

test("no wwn skill declares specialty families (WWN uses foci, not specialties)", () => {
  for (const key of SWN.skills.wwn) {
    const families = SWN.skillSpecialties?.[key];
    assert.ok(
      families === undefined || (Array.isArray(families) && families.length === 0),
      `${key} should have no specialty families`
    );
  }
});

test("every wwn skill has a non-empty localized name and text", () => {
  const block = en.swnr.skills.wwn;
  for (const key of SWN.skills.wwn) {
    assert.ok(block[key], `swnr.skills.wwn.${key} exists`);
    assert.ok(block[key].name?.length > 0, `swnr.skills.wwn.${key}.name non-empty`);
    assert.ok(block[key].text?.length > 0, `swnr.skills.wwn.${key}.text non-empty`);
  }
});

test("wwn set has a source label", () => {
  assert.ok(en.swnr.skills.labels.wwn?.length > 0, "swnr.skills.labels.wwn non-empty");
});

test("sneak is narrowed to movement/concealment; steal owns the thief functions", () => {
  const block = en.swnr.skills.wwn;
  const sneak = block.sneak.text.toLowerCase();
  const steal = block.steal.text.toLowerCase();
  for (const term of ["lock", "trap", "pocket"]) {
    assert.ok(!sneak.includes(term), `sneak text should not mention "${term}"`);
    assert.ok(steal.includes(term), `steal text should mention "${term}"`);
  }
});
