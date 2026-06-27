---
title: "feat: Add WWN skill list + Mundane Alchemist focus"
date: 2026-06-27
type: feat
origin: docs/brainstorms/2026-06-27-wwn-skill-list-requirements.md
---

# feat: Add WWN skill list + Mundane Alchemist focus

## Summary

Add a first-class `wwn` skill set to SWNR — the Worlds Without Number 21-skill list plus **Steal** and **Alchemy** (23 skills) — registered exactly like the existing `banshee` custom list (`CONFIG.SWN.skills` array + `lang/en.json` block + add-skills dialog option). Also add the **Mundane Alchemist** focus to the WWN compendium, since it is the focus that grants the Alchemy skill. No new mechanism is introduced; this mirrors the `banshee` pattern (see origin: `docs/brainstorms/2026-06-27-wwn-skill-list-requirements.md`).

---

## Problem Frame

SWNR ships no WWN skill list. `SWN.skills` in `module/helpers/config.mjs` defines `classic`, `revised`, `cwn`, the custom `banshee`, and `psionic` — all SWN-family. WWN games can only get skills through the `compendiumList` path (the dual-labeled skill Items like `Fix (SWN…) / Craft (WWN)`), and the WWN-only skills (Craft, Magic, Pray, Ride, Sail, Convince) are not localized anywhere. This plan adds the WWN list as a selectable set, with this campaign's two additions (Steal, Alchemy) included.

---

## Requirements

Traceability to origin requirements doc:

- R1–R3 — `wwn` skill set array, the 23 keys, no specialties → U1
- R4–R6 — localization block (names/descriptions, source label) → U2
- R7 — add-skills dialog option → U3
- R8–R9 — Steal text and narrowed Sneak text (in the `wwn` set) → U2
- R10 — Alchemy skill description → U2
- R11–R12 — Mundane Alchemist focus Item in the compendium → U4

---

## Key Technical Decisions

- **Mirror the `banshee` pattern exactly.** A custom skill set is three coordinated edits — a `CONFIG.SWN.skills` array, a `swnr.skills.<set>.*` localization block, and a dialog `<option>`. `initSkills()` and the `_loadSkills` handler iterate the set generically, so no JS logic changes.
- **Per-set localization is mandatory, not reusable.** `initSkills()` resolves `swnr.skills.${skillSet}.${key}.name/.text`, so even keys shared with `revised` (e.g. `administer`, `notice`) need entries under the `wwn` namespace. The `sneak` narrowing therefore lives only in the `wwn` set's string and does not affect `revised`/`cwn`.
- **Steal and Alchemy ship inside the `wwn` set** rather than a separate campaign list, per the brainstorm decision to name the set `wwn` for reuse.
- **Compendium source is YAML, compiled by `pack-compendium`.** The focus is authored as a source `.yml` under `src/packs/wwn-items/` and built into the LevelDB pack with `npm run pack-compendium`.

---

## Implementation Units

### U1. Define the `wwn` skill set in config

**Goal:** Add the `wwn` array to `SWN.skills`.
**Requirements:** R1, R2, R3
**Dependencies:** none
**Files:**
- `module/helpers/config.mjs` (modify — add `wwn` key to `SWN.skills`)
- `tests/node/wwn-skills.test.mjs` (create)

**Approach:** Add `wwn:` alongside `banshee:` in `SWN.skills` with the 23 lowercase keys: `administer, alchemy, connect, convince, craft, exert, heal, know, lead, magic, notice, perform, pray, punch, ride, sail, shoot, sneak, stab, steal, survive, trade, work`. No `SWN.skillSpecialties` entries are added for these keys (`getAvailableSpecialties()` returns `[]` for keys outside the banshee families — R3).

**Patterns to follow:** the `banshee:` array in `module/helpers/config.mjs` (~line 350).

**Test scenarios** (`tests/node/wwn-skills.test.mjs`):
- `CONFIG.SWN.skills.wwn` exists and contains exactly the 23 expected keys (assert set equality).
- `steal` and `alchemy` are present; the other 21 match the WWN core list.
- No `wwn` key returns a non-empty specialties list from `getAvailableSpecialties()`.

**Verification:** the test file passes under `npm test`; the array sits beside `banshee` with matching style.

### U2. Localize the `wwn` skill set

**Goal:** Add `lang/en.json` strings for all 23 skills plus the set label, including the narrowed Sneak, new Steal, and Alchemy descriptions.
**Requirements:** R4, R5, R6, R8, R9, R10
**Dependencies:** U1
**Files:**
- `lang/en.json` (modify — add `swnr.skills.wwn.*` block and `swnr.skills.labels.wwn`)
- `tests/node/wwn-skills.test.mjs` (extend)

**Approach:** Mirror the `swnr.skills.banshee` block. For each of the 23 keys add `name` and `text`. The 21 core skills use their Worlds Without Number rulebook descriptions. `sneak.text` is narrowed to movement/concealment (locks/traps/pockets removed). `steal.text` covers locks, traps, pockets, sleight of hand. `alchemy.text` covers brewing/identifying/employing mundane alchemical works (Int/Alchemy checks; normally granted by the Mundane Alchemist focus). Add `swnr.skills.labels.wwn` (e.g. "Worlds Without Number") for `system.source`.

**Patterns to follow:** the `swnr.skills.banshee.*` and `swnr.skills.labels.banshee` entries in `lang/en.json`.

**Test scenarios** (extend `tests/node/wwn-skills.test.mjs`):
- Covers AE1. Every key in `CONFIG.SWN.skills.wwn` has a non-empty `name` and `text` under `swnr.skills.wwn.<key>` in `lang/en.json` (guards the missing-localization failure mode).
- `swnr.skills.labels.wwn` is present and non-empty.
- Covers AE2. `swnr.skills.wwn.sneak.text` does not mention locks/traps/pockets; `swnr.skills.wwn.steal.text` does.
- `lang/en.json` parses as valid JSON.

**Verification:** populating a character with the `wwn` set produces no "missing localization" (`swnr.skills.wwn.*`) warnings in the Foundry console.

### U3. Add the `wwn` option to the add-skills dialog

**Goal:** Make the set selectable in the bulk add-skills dialog.
**Requirements:** R7
**Dependencies:** U1, U2
**Files:**
- `templates/dialogs/add-bulk-skills.hbs` (modify — add `<option value="wwn">`)

**Approach:** Add an `<option value="wwn">` (label e.g. "Worlds Without Number") to the `skillList` `<select>`, matching the existing `banshee`/`revised` options. The existing `_loadSkills` handler in `module/sheets/actor-sheet.mjs` consumes the value via `initSkills(actor, "wwn")` with no code change.

**Patterns to follow:** the existing `<option>` entries in `templates/dialogs/add-bulk-skills.hbs`.

**Test expectation: none** — static template option; behavior is covered by U1/U2 integrity tests and the manual verification below.

**Verification:** the add-skills dialog lists the new option; selecting it populates 23 WWN skills at untrained rank (AE1).

### U4. Add the Mundane Alchemist focus to the WWN compendium

**Goal:** Author the Mundane Alchemist focus Item and build it into the compendium pack.
**Requirements:** R10, R11, R12
**Dependencies:** none (independent of U1–U3)
**Files:**
- `src/packs/wwn-items/Mundane_Alchemist_<id>.yml` (create)
- compiled `packs/` output (regenerated by `npm run pack-compendium`)

**Approach:** Create a source YAML matching the existing WWN focus Item shape: top-level `name: Mundane Alchemist`, `type: feature`; `system.type: focus`, `system.level: 1`, `system.poolsGranted: []`, `system.favorite: false`; `system.description` carrying the *Atlas of the Latter Earth* text with both levels (Level 1: gain Alchemy-0 + lesser works + scavenge lab gear; Level 2: greater works + level×25 sp of materials per week). Place it in the same foci folder as other WWN foci (read the `folder` id from an existing `wwn-items` focus at build time). Generate a fresh 16-char `_id` and matching `_key: !items!<id>`. Run `npm run pack-compendium` to compile.

**Patterns to follow:** `src/packs/wwn-items/Armsmaster_orpagnhsl9t1usx3.yml` (focus Item structure, including the inline `Level 1:`/`Level 2:` description style).

**Test scenarios:**
- Covers AE3. `npm run pack-compendium` completes without error and the compiled pack contains a `Mundane Alchemist` focus.
- The focus `system.description` includes both the Level 1 and Level 2 text.

**Verification:** the focus appears in the WWN foci compendium in Foundry and can be dragged onto an actor like any other focus.

---

## Scope Boundaries

- The existing dual-labeled WWN compendium skill Items (`compendiumList` path) and the `banshee` specialty system are untouched.
- No skill-specialty families are added for the `wwn` set.
- No other *Atlas* content (alchemical works tables, the Wise class, lab rules) is ported — only the focus and the Alchemy skill entry.

### Deferred to Follow-Up Work

- Whether `alchemy` should be excluded from the default bulk-populate (the rules gate it behind the Mundane Alchemist focus). Current decision: leave it in; the GM prunes it for non-alchemists.

---

## Risks & Dependencies

- **Missing-localization is the main failure mode.** A `wwn` key without a `swnr.skills.wwn.<key>` entry renders as a raw i18n path on the sheet. U2's coverage test guards this directly.
- **Pack rebuild required.** The focus is not live until `npm run pack-compendium` regenerates the LevelDB pack; the source `.yml` alone is not loaded by Foundry.
- No changes to `initSkills()` / `_loadSkills` — the generic iteration over `CONFIG.SWN.skills[skillSet]` already supports a new set.

---

## Open Questions

### Deferred to Implementation
- The exact new focus Item `_id` and target `folder` id (read from an existing `wwn-items` focus during U4).
- Final wording of the 21 core WWN skill descriptions (drawn from the WWN rulebook; not reproduced here to avoid copying bulk text into the plan).

---

## Sources & Research

- `module/helpers/config.mjs` — `SWN.skills` definitions; `banshee` is the template.
- `module/helpers/utils.mjs` — `initSkills()` (set → skill Items; per-set localization).
- `module/sheets/actor-sheet.mjs` — `_loadSkills` dialog handler.
- `lang/en.json` — `swnr.skills.*` localization blocks.
- `templates/dialogs/add-bulk-skills.hbs` — the skill-list `<select>`.
- `src/packs/wwn-items/Armsmaster_orpagnhsl9t1usx3.yml` — reference focus Item shape.
- `package.json` — `pack-compendium` (pack build), `test` (`node --test tests/node/*.test.mjs`).
- *Atlas of the Latter Earth*, "Mundane Alchemy" — Alchemy skill + Mundane Alchemist focus text.
