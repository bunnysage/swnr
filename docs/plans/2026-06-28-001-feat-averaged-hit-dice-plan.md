---
date: 2026-06-28
type: feat
title: "feat: Averaged Hit Dice (bell-curve HP) world setting"
origin: docs/brainstorms/2026-06-28-averaged-hit-dice-requirements.md
---

# feat: Averaged Hit Dice (Bell-Curve HP)

## Summary

Add a world-scoped boolean setting (`useAveragedHitDice`, default off) that, when
enabled, rewrites each hit die in a hit-dice HP roll into two dice of half its size
(`d6` → `2d3`, `d8` → `2d4`, etc.) before the roll is evaluated. The transform applies
to both the PC per-level HP path and the NPC hit-dice path. Unsupported die sizes fall
through to the original roll with a notification; flat NPC HP values are untouched. The
hit die shown on sheets is never rewritten — only the rolled formula changes.

(see origin: `docs/brainstorms/2026-06-28-averaged-hit-dice-requirements.md`)

---

## Problem Frame

Single-die hit-dice rolls are flat-distributed: a `d8` hit die is equally likely to give
1 or 8, so same-class same-level characters can diverge by 7 HP per level on luck alone.
Tables that find this too swingy currently have to rewrite hit dice by hand. The setting
moves the smoothing under the hood — the listed hit die stays as authored, and only the
roll evaluation changes to two smaller dice, producing a triangular (bell-ish)
distribution with reduced variance.

The transform is intrinsic-shift-accepted: every split raises the die's minimum from 1 to
2 and its average by exactly +0.5 while leaving the maximum unchanged (origin Key
Decision). This is by design, not corrected.

---

## Key Technical Decisions

- **One shared mapping helper, two call sites.** The PC path (`module/data/actors/actor-character.mjs`)
  stores `hitDie` as a single die string (`"d6"`); the NPC path
  (`module/data/actors/actor-npc.mjs`) builds a possibly-multi-die `dieRoll` string
  (`"3d8"`). A single pure helper that rewrites a die-bearing string into its averaged form
  serves both, keeping the mapping table and the unsupported-die detection in one place
  rather than duplicated. Helper lives in `module/helpers/` (new file) so both data models
  can import it without a circular dependency.

- **Fixed mapping table, no arithmetic generalization.** Mapping is an explicit lookup —
  `d4`→`2d2`, `d6`→`2d3`, `d8`→`2d4`, `d10`→`2d5`, `d12`→`2d6` — not a computed
  `floor(N/2)`. This makes "supported set" and "unsupported → notify" the same lookup: a
  miss in the table is an unsupported die. (Generalizing the math would silently "support"
  odd sizes like `d7`→`2d3.5`, which the origin explicitly excludes.)

- **Transform multi-die by count.** For NPC formulas like `3d8`, each die is split and the
  count doubled: `3d8` → `6d4`. The helper parses the leading integer count (default 1) and
  multiplies it by 2 against the halved die. Soak (`+N`) is already stripped upstream in the
  NPC path before the die string is built, so the helper only ever sees a bare `NdX`.

- **Transform at formula-assembly time, gated on the setting.** Each call site reads
  `game.settings.get("swnr", "useAveragedHitDice")` and, when true, passes its die string
  through the helper before constructing the `Roll`. When false, the existing code path is
  byte-for-byte unchanged (origin R2).

- **Flavor shows the split openly.** When a transform happens, the PC confirm dialog and the
  PC/NPC chat output describe it as `2d3 (averaged d6)` (origin R9, Key Decision). The
  underlying Foundry dice tooltip already shows the real dice, so the flavor matches reality
  rather than masking it.

- **Unsupported die → notify + original roll.** A die outside the table is left untransformed
  and a `ui.notifications` message states averaging isn't configured for it and the normal
  hit die was rolled (origin R7). Flat NPC HP (`"15 HP"`) reaches the helper as a non-dice
  string and is returned unchanged with no notification (origin R8).

---

## Requirements Traceability

| Origin | Covered by |
|---|---|
| R1 (world boolean setting) | U1 |
| R2 (off = stock behavior) | U2, U3 (gate), AE5 |
| R3 (mapping transform) | U1 (helper) |
| R4 (PC path) | U2 |
| R5 (NPC path, multi-die) | U3 |
| R6 (preserve floors/CON/soak) | U2, U3 |
| R7 (unsupported → notify + original) | U1, U2, U3 |
| R8 (flat NPC HP untouched) | U1, U3 |
| R9 (open flavor text) | U2, U3, U4 |

---

## Implementation Units

### U1. Averaged-hit-dice mapping helper

- **Goal:** A pure, side-effect-free helper that converts a die-bearing string into its
  averaged form and reports whether a usable transform occurred, so both data models share
  one mapping and one unsupported-die rule.
- **Requirements:** R3, R7, R8
- **Dependencies:** none
- **Files:**
  - `module/helpers/averaged-hit-dice.mjs` (new)
  - `module/helpers/averaged-hit-dice.test.mjs` (new — or the repo's existing test location/convention if one is found during work; see Test scenarios)
- **Approach:** Export a function that accepts a die/formula string (`"d6"`, `"3d8"`,
  `"15 HP"`, `"d20"`) and returns a small result object: the rewritten formula, the original,
  and a status (`transformed` / `unsupported` / `not-a-die`). Internals:
  - Mapping table `{4:"d2", 6:"d3", 8:"d4", 10:"d5", 12:"d6"}` keyed by original die size.
  - Parse with a tolerant regex capturing optional leading count and die size
    (`/^(\d*)d(\d+)$/i`), treating missing count as 1.
  - On a table hit: output `${count*2}${halfDie}` (e.g. `3d8` → `6d4`, `d6` → `2d3`),
    status `transformed`, and a human label `"2d3 (averaged d6)"` for callers to use in flavor.
  - On a parseable die whose size is not in the table: status `unsupported`, formula
    returned unchanged.
  - On a string that isn't an `NdX` die (e.g. `"15 HP"`, `""`, `"0"`): status `not-a-die`,
    returned unchanged, no notification implied.
  - Helper does not call `ui.notifications` or read settings — callers own those (keeps it
    pure and unit-testable).
- **Patterns to follow:** Existing helpers in `module/helpers/` for module/export shape. NPC
  die parsing in `module/data/actors/actor-npc.mjs` (`hitDiceRegex`, `_extractHitDiceNumber`)
  for the regex idiom already used in this codebase.
- **Test scenarios:**
  - Covers R3. `d4`→`2d2`, `d6`→`2d3`, `d8`→`2d4`, `d10`→`2d5`, `d12`→`2d6`, each status `transformed`.
  - Covers R3/R5. Multi-die: `3d8`→`6d4`, `2d6`→`4d3`, `1d10`→`2d5`. Count multiplies by 2.
  - Covers R3. Implicit count: bare `d8` treated as `1d8`→`2d4`.
  - Covers R7. Unsupported die: `d20`, `d3`, `d100`, `d7` → status `unsupported`, formula unchanged.
  - Covers R8. Non-dice: `"15 HP"`, `"0"`, `""`, `null`/`undefined` → status `not-a-die`, unchanged, no throw.
  - Label text: `d6` produces label `"2d3 (averaged d6)"`.
  - Case-insensitivity: `3D8` parses the same as `3d8`.
- **Verification:** Unit tests pass; helper is importable from both actor data models without
  circular-import errors.

### U2. Apply transform on the PC per-level HP roll

- **Goal:** When the setting is on, PC level-up HP uses the averaged die per level, with the
  CON modifier and per-level floor preserved and the dialog/chat flavor showing the split.
- **Requirements:** R2, R4, R6, R7, R9
- **Dependencies:** U1
- **Files:** `module/data/actors/actor-character.mjs` (`rollHitDice`, around lines 394–468)
- **Approach:** Before building `perLevel = max(${hd} + ${constBonus}, 1)`, when
  `game.settings.get("swnr", "useAveragedHitDice")` is true, run `hd` through the U1 helper.
  - `transformed`: substitute the averaged formula into `perLevel` (so each per-level term
    becomes `max(2d3 + con, 1)`), and incorporate the helper's label into the dialog `content`
    and the chat `msg` flavor (e.g. "Rolling 2d3 (averaged d6) per level").
  - `unsupported`: leave `hd` as-is, fire a `ui.notifications` message (averaging not set up
    for this die; rolling normal hit die), and proceed with the stock formula.
  - Setting off: skip all of the above — existing code unchanged (R2).
  - The `max(..., 1)` floor, `constBonus` addition, and the level>1 `Math.max(hpRoll, currentHp+1)`
    logic are untouched (R6).
- **Patterns to follow:** Existing `game.settings.get("swnr", ...)` reads elsewhere in this
  file / data models; existing `ui.notifications?.info(...)` usage in `rollHitDice`.
- **Test scenarios:**
  - Covers AE1. Setting on, `d6` hit die: assembled per-level formula contains `2d3`, dialog
    and chat flavor reference `2d3 (averaged d6)`, CON mod still added, per-level floor still applied.
  - Covers R6. Level 3 character: still rolls one (averaged) die per level and applies the
    `currentHp + 1` minimum for level>1.
  - Covers R7. Setting on, hit die `d20`: formula uses `d20` unchanged, notification fired.
  - Covers AE5/R2. Setting off, `d6`: formula and flavor identical to current behavior, no
    averaging text, no notification.
  - Integration: a full `rollHitDice` invocation with the setting on persists a `health.max`
    consistent with a `2d3`-per-level roll (min 2/level before CON/floor), proving the
    transform feeds the actual `Roll`, not just the flavor string.
- **Verification:** Manual: toggle the setting, level a `d6` PC, confirm dialog/chat show the
  split and HP lands in the averaged range; toggle off and confirm stock behavior.

### U3. Apply transform on the NPC hit-dice roll

- **Goal:** When the setting is on, NPC HP rolls split each hit die (including multi-die HD),
  leave flat-HP NPCs untouched, notify on unsupported dice, and preserve soak handling.
- **Requirements:** R2, R5, R6, R7, R8, R9
- **Dependencies:** U1
- **Files:** `module/data/actors/actor-npc.mjs` (`rollHitDice`, around lines 286–353)
- **Approach:** After the existing logic resolves the concrete `dieRoll` string (post soak-strip,
  post format normalization to an `NdX` form) and before `new Roll(dieRoll)`, when the setting
  is on run `dieRoll` through the U1 helper.
  - `transformed`: roll the averaged formula (`3d8` → `6d4`) and add `2d3 (averaged d6)`-style
    flavor to the NPC HP chat output (R9). Note: today the NPC path updates health without a
    chat message — adding a chat message for the averaged case is in scope per R9; keep the
    non-averaged path's current behavior unchanged.
  - `unsupported`: roll the original `dieRoll`, fire a `ui.notifications` message (R7).
  - `not-a-die` is unreachable here because the NPC branch only builds `dieRoll` for actual dice;
    the flat-`HP` branch (`hpRegex`) produces a numeric `dieRoll` like `"15"` — confirm during
    work whether a bare number reaches the helper and ensure it is returned unchanged with no
    notification (R8). If the flat-HP path bypasses `dieRoll` assembly entirely, no helper call
    is made and R8 holds trivially.
  - Soak parsing/strip earlier in the method is untouched (R6).
  - Setting off: existing code path unchanged (R2).
- **Patterns to follow:** Existing `dieRoll` assembly branches in `rollHitDice`; existing
  `ui.notifications?.error/info` usage in the same method; `ChatMessage` creation pattern from
  the PC `rollHitDice` in `module/data/actors/actor-character.mjs` for the new averaged-case chat output.
- **Test scenarios:**
  - Covers AE2/R5. Setting on, HD `3d8`: rolled formula is `6d4`; a trailing `+N` soak is still
    applied as today.
  - Covers R5. Setting on, bare count `3` (→`3d8` today): rolled formula is `6d4`.
  - Covers AE4/R8. Setting on, HD `"15 HP"`: value taken as 15, no split, no notification.
  - Covers R7. Setting on, HD `2d20`: rolled unchanged, notification fired.
  - Covers AE5/R2. Setting off, HD `3d8`: rolls `3d8` exactly as today, no averaging flavor.
- **Verification:** Manual: with setting on, roll HD on a `3d8` NPC and confirm HP lands in the
  `6d4` range; confirm a flat-HP NPC and an unsupported-die NPC behave per R7/R8; toggle off for
  stock behavior.

### U4. Register the setting and localization strings

- **Goal:** The feature is switchable via a world setting in the Foundry settings UI, with
  localized name/hint, defaulting off.
- **Requirements:** R1
- **Files:**
  - `module/helpers/register-settings.mjs` (add registration; mirror `useHomebrewLuckSave` block)
  - `lang/en.json` (add `swnr.settings.useAveragedHitDice` + `...Hint` near the other settings
    strings, around line 2158)
- **Approach:** Register `useAveragedHitDice` as `scope: "world", config: true, type: Boolean,
  default: false`, mirroring the existing `useHomebrewLuckSave` block exactly. Add the `name`/`hint`
  i18n keys. The hint should briefly explain the bell-curve intent and that unsupported dice roll
  normally. If `register-settings.mjs` maintains a settings-snapshot object (the `game.settings.get`
  aggregation near the bottom of the file), add the new key there too for consistency.
- **Patterns to follow:** `useHomebrewLuckSave` / `useRollNPCHD` registration blocks
  (`module/helpers/register-settings.mjs:44–60`) and their lang entries (`lang/en.json:2158–2161`).
- **Test scenarios:** `Test expectation: none — registration + i18n only, no behavioral logic.`
  Behavioral coverage of the setting gate lives in U2/U3.
- **Verification:** Setting appears in the Foundry "Configure Settings" UI under the system, labeled
  and hinted from `en.json`, defaults off; toggling it flips U2/U3 behavior.

---

## Scope Boundaries

- Displayed hit dice on sheets and stat blocks are not rewritten — only roll evaluation changes.
- No die sizes beyond d4/d6/d8/d10/d12; others intentionally hit the R7 notification path.
- No alternate averaging schemes (drop-lowest, `2dX-1` mean-preservation, take-average-instead-of-roll).
- Per-client variation is out of scope; the setting is world-scoped.

### Deferred to Follow-Up Work

- Localizing the new flavor/notification strings into non-English `lang/*.json` files beyond
  `en.json` — follow the repo's existing localization cadence rather than blocking this feature.

---

## Risks & Dependencies

- **Foundry dN support for halved dice.** The averaged forms use `d2`, `d3`, and `d5`. Foundry's
  dice engine supports arbitrary `dN`, but confirm `d3`/`d5` evaluate cleanly during U1 work
  (origin Assumption). If any size is unsupported, that is a blocking surprise to surface, not
  silently work around.
- **NPC flat-HP path shape.** R8 depends on the flat-`HP` branch not feeding a transformable die
  string into the helper. U3 must confirm the exact `dieRoll` value the flat-HP branch produces
  and ensure the helper returns it unchanged (the `not-a-die` / bare-number case).
- **Test harness location.** Confirm whether this repo already runs JS unit tests (and where) so
  U1's helper tests land in the right place and convention; if none exists, U1 still ships the
  helper with tests authored against the discovered/standard runner.

---

## Sources & Research

- Origin requirements: `docs/brainstorms/2026-06-28-averaged-hit-dice-requirements.md`
- PC roll path: `module/data/actors/actor-character.mjs` (`rollHitDice`, lines ~394–468; `hitDie`
  schema line 30)
- NPC roll path: `module/data/actors/actor-npc.mjs` (`rollHitDice`, lines ~286–353; HD regexes
  lines 12–13; `hitDice` schema line 35)
- Settings pattern: `module/helpers/register-settings.mjs` (`useHomebrewLuckSave` 44–51,
  `useRollNPCHD` 53–60); strings `lang/en.json:2158–2161`
- Project guidance: `CLAUDE.md` (V13 essentials, fork-only PR rule, bunnysage commit identity)
