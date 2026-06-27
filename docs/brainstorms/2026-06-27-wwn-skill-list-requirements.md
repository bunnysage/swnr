---
date: 2026-06-27
topic: wwn-skill-list
---

# WWN Skill List + Mundane Alchemist Focus

## Summary

Add a first-class `wwn` skill list to SWNR — the Worlds Without Number 21-skill list plus **Steal** and **Alchemy** (23 skills) — registered the same way the existing `banshee` custom list is. Also add the **Mundane Alchemist** focus (from *Atlas of the Latter Earth*) to the WWN compendium, since it is the focus that grants the Alchemy skill.

## Key Decisions

- **Named `wwn`, not campaign-specific.** SWNR ships no WWN skill list today (only `classic`, `revised`, `cwn`, the custom `banshee`, and `psionic` — all SWN-family). The new set is named `wwn` so it doubles as the reusable WWN list the system is missing, with this campaign's two additions riding along inside it.
- **Built on the true WWN skill set, not SWN `revised`.** The list uses WWN's vocabulary (Craft, Magic, Pray, Ride, Sail, Convince), which means authoring those skill strings for the first time — `revised` would have imported the wrong SWN names (fix/program/pilot/talk).
- **Steal and Alchemy are deliberate additions to stock WWN.** Steal is a homebrew split of Sneak (decided in a prior brainstorm); Alchemy is an optional *Atlas* skill. Both live in the `wwn` set rather than a separate campaign list.
- **Follow the `banshee` pattern exactly.** A custom list is three coordinated edits: a `CONFIG.SWN.skills` array, a `lang/en.json` localization block, and an option in the add-skills dialog. No new mechanism is introduced.

## Requirements

### Skill list

R1. Add a `wwn` key to `SWN.skills` in `module/helpers/config.mjs` containing the 23 skill keys (lowercase, matching existing key convention): `administer, alchemy, connect, convince, craft, exert, heal, know, lead, magic, notice, perform, pray, punch, ride, sail, shoot, sneak, stab, steal, survive, trade, work`.

R2. The 21 stock keys reproduce the Worlds Without Number skill list; `steal` and `alchemy` are the only additions.

R3. The `wwn` set ships with no skill specialties — `getAvailableSpecialties()` returns `[]` for these keys (specialties are a `banshee` house-rule; WWN uses foci).

### Localization

R4. Add a `swnr.skills.wwn.<key>.name` and `swnr.skills.wwn.<key>.text` entry in `lang/en.json` for all 23 skills. `initSkills()` resolves names/descriptions from this per-set namespace, so shared keys cannot reuse the `revised` strings — every key needs an entry under `wwn`.

R5. Add `swnr.skills.labels.wwn` as the set's source label (e.g. "Worlds Without Number"); `initSkills()` writes it to each created skill's `system.source`.

R6. The 21 stock skills use their Worlds Without Number rulebook descriptions. `steal` and `sneak` use the edited text in R8/R9; `alchemy` uses the text in R10.

### Add-skills dialog

R7. Add an `<option value="wwn">` to the skill-list `<select>` in `templates/dialogs/add-bulk-skills.hbs` so the set is selectable in the bulk-add dialog. The existing `_loadSkills` / `initSkills` path consumes it with no code change.

### Sneak / Steal split

R8. `steal` description: pick locks, set or disable traps, pick pockets, palm objects, and sleight of hand — defeating security or relieving a mark by deft hands.

R9. `sneak` description (narrowed for the `wwn` set): move silently, hide, shadow a target, and avoid notice — movement and concealment only; lock-picking, trap-work, and pickpocketing move to Steal. This narrowing applies only to the `wwn` set's `sneak` string, not to `revised`/`cwn`.

### Mundane Alchemist focus

R10. `alchemy` description: brew, identify, and employ mundane alchemical substances and works; checks are normally Int/Alchemy. Note that gaining or raising Alchemy normally requires the Mundane Alchemist focus.

R11. Add a **Mundane Alchemist** focus Item to the WWN compendium source (`src/packs/wwn-items/`), matching the existing focus Item shape: `type: feature`, `system.type: focus`, `system.level: 1`, `system.poolsGranted: []`, placed in the same foci folder as other WWN foci.

R12. The focus `system.description` carries the *Atlas* text, both levels:
- **Level 1:** Gain Alchemy-0 as a bonus skill. You have formulae for all common lesser works but cannot yet devise greater works, even with the formula. You can scavenge or jury-rig lab equipment sufficient to create lesser works unless completely separated from all adequate makeshifts.
- **Level 2:** You have formulae for all common greater works and can compound them at the usual difficulty. A week of lab work and access to common mundane materials lets you create (level × 25) silver pieces worth of alchemical components for compounding your own works.

## Acceptance Examples

AE1. **Covers R1, R4, R5, R7.** Opening the bulk add-skills dialog on a character and choosing "Worlds Without Number" populates the sheet with all 23 WWN skills at untrained rank, each labeled with the WWN source.

AE2. **Covers R8, R9.** The populated sheet shows both `Sneak` and `Steal` as separate skills, with Sneak's text limited to movement/concealment and Steal's covering locks/traps/pockets.

AE3. **Covers R11, R12.** The WWN foci compendium contains a `Mundane Alchemist` focus whose description includes the Level 1 and Level 2 text, addable to an actor like any other focus.

## Scope Boundaries

- The existing dual-labeled WWN compendium skill Items (the `compendiumList` path, e.g. `Fix (SWN…) / Craft (WWN)`) are left untouched. The new `wwn` config set is the clean parallel path, not a replacement for them.
- No skill-specialty families are added for the `wwn` set.
- No other *Atlas* content (alchemical works tables, the Wise class, lab rules) is ported — only the focus and the Alchemy skill entry.

## Dependencies / Assumptions

- Compendium packs build from `src/packs/<pack>/*.yml` into the compiled LevelDB pack via the system's pack build step; adding the focus means adding a source `.yml` and rebuilding the pack.
- `initSkills()` and the `_loadSkills` dialog handler need no code changes — they already iterate `CONFIG.SWN.skills[skillSet]` generically.

## Outstanding Questions

### Deferred to planning
- Whether `alchemy` should be excluded from the default bulk-populate (since the rules gate it behind the Mundane Alchemist focus) or left in for convenience and pruned by the GM. Current decision: leave it in.
- The exact new focus Item `_id` and target folder id (read from an existing `wwn-items` focus at build time).

## Sources

- `module/helpers/config.mjs` — `SWN.skills` set definitions (the `banshee` pattern to copy).
- `module/helpers/utils.mjs` — `initSkills()` / `initCompendSkills()` (how a set becomes skill Items).
- `module/sheets/actor-sheet.mjs` — `_loadSkills` dialog handler.
- `lang/en.json` — `swnr.skills.*` localization blocks.
- `templates/dialogs/add-bulk-skills.hbs` — the skill-list select.
- `src/packs/wwn-items/Armsmaster_orpagnhsl9t1usx3.yml` — reference focus Item shape.
- *Atlas of the Latter Earth*, "Mundane Alchemy" — the Alchemy skill and Mundane Alchemist focus.
- *Worlds Without Number* — the core 21-skill list and descriptions.
