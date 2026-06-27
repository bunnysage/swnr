---
title: "feat: Mythras below-zero location, wounds removal, location macros"
type: feat
date: 2026-06-27
status: ready
branch: feat/injury-mythras-location
origin: docs/brainstorms/2026-06-27-injury-mythras-location-and-wounds-removal-requirements.md
---

# feat: Mythras below-zero location, wounds-counter removal, location macros

## Summary

Five changes to the swnr death & dismemberment / injury system (see origin: `docs/brainstorms/2026-06-27-injury-mythras-location-and-wounds-removal-requirements.md`):

1. The below-zero wound path rolls a **Mythras 1d20** hit location; above-zero paths keep their 1d12.
2. The **`wounds` counter is removed** everywhere; `injuries` becomes the sole carried-wound track.
3. Below-zero `applyWounds` now **persists an injury Item** (+ `injuries++`), matching the threshold path.
4. A new **Macro compendium** ships two GM location-roller macros.
5. The **NPC header surfaces the `injuries` counter**.

**Target repo:** swnr (worktree on `feat/injury-mythras-location`, PR base `dev`).

---

## Problem Frame

Today one shared `_rollInjuryLocation()` (1d12) feeds all three injury paths, and a `wounds` counter runs parallel to `injuries` with no death/defeat logic depending on it. The wwn lineage uses an anatomical Mythras 1d20 table for downed characters; the two tables were always meant to differ. Below-zero hits also currently evaporate into a chat card with no durable record. This plan ports the Mythras table for the downed path, makes below-zero injuries persist like threshold injuries, and cuts the redundant `wounds` track.

---

## Requirements

- **R1** — Below-zero `applyWounds` rolls a Mythras 1d20 location; threshold + above-zero-crit keep 1d12.
- **R2** — Below-zero creates a persistent `injury` Item (Mythras location + severity), `injuries += 1`; severity math unchanged (`1d12 + 2×injuries + excess − critResistance`).
- **R3** — Remove `wounds` from schema, sheet header, chat template, `_calculateWoundThresholds`, and both `applyWounds` and `applyCriticalInjury`.
- **R4** — `applyCriticalInjury` tracks only `injuries` after the removal.
- **R5** — New Macro compendium with two GM macros: "Roll Threshold Injury Location" (1d12) and "Roll Death & Dismemberment Location" (Mythras 1d20), posting to chat.
- **R6** — Surface the `injuries` counter on the NPC header (widen the `character`-only gate); the injury-Item list already renders on both sheets, so below-zero Items appear automatically.

### Acceptance Examples

- **AE1** — Character at 3 HP takes 7 damage: `applyWounds` rolls 1d20 Mythras location, creates an `injury` Item (location + severity band), `injuries++`, posts the GM card, and writes no `wounds`.
- **AE2** — Character sheet header shows no `wounds` field; only `injuries`.
- **AE3** — "Roll Death & Dismemberment Location" with no token selected posts a Mythras 1d20 result; "Roll Threshold Injury Location" posts a 1d12 result.
- **AE4** — An above-zero threshold injury still rolls 1d12 and is otherwise unchanged.
- **AE5** — NPC sheet (death & dismemberment on) shows an `injuries` counter in the header, and below-zero injury Items appear in its injury list.

---

## Key Technical Decisions

- **KTD1 (OQ2) — Pure, shared location tables.** Extract both location tables into a Foundry-free module (`module/helpers/injury-locations.mjs`), mirroring `module/helpers/injury-thresholds.mjs`. Two pure resolvers map a die total to a location record: `resolveThresholdLocation(d12)` (existing arm/leg/torso/head + needs-side) and `resolveMythrasLocation(d20)` (ported from `wwn/module/actor/types/character.mjs:307`). The actor rolls the die (Foundry `Roll`) and the side roll, then calls the resolver; the macros call the **same** resolver. This makes the tables node-testable and keeps one source of truth.
- **KTD2 (OQ1) — Below-zero severity band reuses `getThresholdSeverityBand`.** The below-zero severity score (typically high) is passed through the existing `getThresholdSeverityBand(score)` to set the `injury` Item's severity enum. High scores land Serious/Severe naturally; no new band scale. The existing `_getInjuryEffectDescription` below-zero text still drives `mechanicalEffect`.
- **KTD3 (OQ3) — No migration for stored `wounds`.** `dev` is unreleased; removing the schema field lets Foundry's data model drop the orphaned `system.wounds` on next write. No migration script.
- **KTD4 — Macros call a system-exposed roller, not an inline table.** Expose a small roller on the system API (e.g. `game.swnr.rollInjuryLocation("mythras"|"threshold")`) that rolls + posts to chat using the shared resolver, so each macro is a one-liner and the table is never duplicated in macro script.
- **KTD5 — Keep `_rollInjuryLocation` (1d12) for threshold + crit.** Add a sibling `_rollMythrasLocation` (1d20) for `applyWounds` only. The two tables stay distinct by design.

---

## Implementation Units

### U1. Pure location-table helper + unit tests

**Goal:** One Foundry-free source for both location tables.
**Requirements:** R1, R5 (shared source).
**Dependencies:** none.
**Files:**
- `module/helpers/injury-locations.mjs` (create)
- `tests/node/injury-locations.test.mjs` (create)

**Approach:** Export `resolveThresholdLocation(total)` returning `{ location, locationIcon, needsSide }` for a 1d12 (mirror the current `_rollInjuryLocation` mapping: ≤2 arm, ≤4 leg, ≤9 torso, else head). Export `resolveMythrasLocation(total)` returning `{ result, details, needsSide }` for a 1d20, ported verbatim from the wwn Mythras table (`wwn/module/actor/types/character.mjs:307`). No Foundry imports; the caller owns the `Roll` and any side (1d2) roll.

**Patterns to follow:** `module/helpers/injury-thresholds.mjs` (pure module) and `tests/node/injury-thresholds.test.mjs` (node:test).

**Test scenarios:**
- Covers AE4. `resolveThresholdLocation` boundary mapping: 1→arm, 2→arm, 3→leg, 4→leg, 5→torso, 9→torso, 10→head, 12→head; arm/leg set `needsSide: true`, torso/head false.
- `resolveMythrasLocation` boundary mapping across all 1d20 ranges (each range's low and high bound returns the expected result/details).
- Out-of-range / non-numeric input degrades to a defined fallback location rather than throwing.

**Verification:** `npm test` passes the new file; both resolvers cover every range boundary.

---

### U2. Mythras location for the below-zero path

**Goal:** `applyWounds` rolls Mythras 1d20; threshold + crit stay 1d12.
**Requirements:** R1.
**Dependencies:** U1.
**Files:**
- `module/documents/actor.mjs` (modify — add `_rollMythrasLocation`, call it from `applyWounds`)

**Approach:** Add `_rollMythrasLocation()` that rolls `1d20`, calls `resolveMythrasLocation`, and (when `needsSide`) rolls 1d2 for L/R — mirroring the shape `_rollInjuryLocation` returns so downstream display/Item code is unchanged. `applyWounds` calls `_rollMythrasLocation` instead of `_rollInjuryLocation`. `applyCriticalInjury` and `applyThresholdInjury` keep `_rollInjuryLocation` (1d12).

**Patterns to follow:** existing `_rollInjuryLocation` (`module/documents/actor.mjs:159`).

**Test scenarios:** `Test expectation: none at node level — Foundry-bound Roll + actor glue; the table mapping is covered by U1. Validate via the U2/U3 manual Foundry check.`

**Verification:** Covers AE1/AE4. A below-zero hit shows a Mythras location (e.g. "Right Arm"); an above-zero threshold injury still shows a 1d12 location.

---

### U3. Below-zero persists an injury Item; drop its wounds write

**Goal:** `applyWounds` creates a durable `injury` Item and `injuries++`, no `wounds`.
**Requirements:** R2.
**Dependencies:** U2.
**Files:**
- `module/documents/actor.mjs` (modify — `applyWounds`)

**Approach:** After Mythras location + the unchanged severity roll, set the Item's severity band via `getThresholdSeverityBand(severityScore)` (KTD2) and `createEmbeddedDocuments("Item", [{ type: "injury", system: { severity, location, source, mechanicalEffect, persistent, severityScore, locationRoll, description } }])`, mirroring `applyThresholdInjury` (`:512`). Increment `system.injuries` by 1. Keep the GM chat card. Remove the `system.wounds` update and the `_calculateWoundThresholds` call from this method. `mechanicalEffect`/description come from the existing `_getInjuryEffectDescription`.

**Patterns to follow:** the injury-Item creation block in `applyThresholdInjury` (`module/documents/actor.mjs:512`).

**Test scenarios:** `Test expectation: none at node level — createEmbeddedDocuments + Roll require live Foundry. Covered by the manual check + AE1.`

**Verification:** Covers AE1. Below-zero hit creates an `injury` Item visible in the actor's injury list, increments `injuries`, writes no `wounds`.

---

### U4. Remove the `wounds` counter everywhere

**Goal:** Delete `wounds` from data model, logic, sheet, and chat.
**Requirements:** R3, R4.
**Dependencies:** U3 (so `applyWounds` no longer references it).
**Files:**
- `module/data/actors/base-actor.mjs` (remove `wounds` schema field, `:63`)
- `module/documents/actor.mjs` (delete `_calculateWoundThresholds`; remove `wounds` reads/writes + `woundBefore/woundAfter` chat data in `applyCriticalInjury`; ensure `applyWounds` clean)
- `templates/actor/header.hbs` (collapse the `Inj/Wnd` paired field to a single `injuries` field; relabel)
- `templates/chat/critical-injury.hbs` (remove the `wounds` row, `:37`)
- `lang/en.json` (remove now-unused `swnr.injury.wounds` if present)

**Approach:** Mechanical removal. Verify no remaining `system.wounds` reference (grep) and that `_getInjuryEffectDescription`'s "additional wounds" text (`:218`) is reconciled — keep the narrative effect text but it no longer drives a counter. Confirm the critical-injury chat template still renders with the row gone.

**Patterns to follow:** existing single-resource header fields in `templates/actor/header.hbs`.

**Test scenarios:** `Test expectation: none — schema/template/dead-code removal; behavior covered by AE2 manual check and existing injury tests staying green.`

**Verification:** Covers AE2. No `system.wounds` reference remains anywhere; character header shows only `injuries`; critical-injury card renders without a wounds row; `npm test` green.

---

### U5. NPC header shows the injuries counter

**Goal:** Surface `injuries` on the NPC sheet header.
**Requirements:** R6.
**Dependencies:** U4 (header field already simplified to `injuries`-only).
**Files:**
- `templates/actor/header.hbs` (widen the `actor.type === 'character'` gate around the injuries field to include `npc`, keeping the `useDeathAndDismemberment` gate)

**Approach:** `header.hbs` is a shared sheet part already rendered for NPCs. Change the gate from character-only to character-or-npc so the `injuries` counter shows for both. No NPC-template change needed; the injury-Item list (`injury-list.hbs`) is already included on `npc.hbs`.

**Patterns to follow:** the existing `{{#if (eq actor.type 'character')}}` / `useDeathAndDismemberment` gate in `header.hbs`.

**Test scenarios:** `Test expectation: none -- template gate change; covered by AE5 manual check.`

**Verification:** Covers AE5. NPC sheet (death & dismemberment on) shows the `injuries` counter; character sheet unchanged.

---

### U6. Macro compendium with two location rollers

**Goal:** Two GM macros that roll the two location tables to chat.
**Requirements:** R5.
**Dependencies:** U1 (shared resolver), U2 (system roller).
**Files:**
- `module/swnr.mjs` (expose a roller on the system API, e.g. `game.swnr.rollInjuryLocation(kind)`, using the shared resolver + a chat post)
- `src/packs/swnr-macros/Roll_Threshold_Injury_Location.yml` (create — script macro calling the threshold roller)
- `src/packs/swnr-macros/Roll_Death_and_Dismemberment_Location.yml` (create — script macro calling the Mythras roller)
- `system.json` (register the new `Macro` pack)

**Approach:** Add a small system-exposed roller (KTD4) that rolls the requested table via the shared resolver and posts a chat message; each macro is a one-line call. Author the two macros as YAML in a new `src/packs/swnr-macros/` source dir and register the pack in `system.json` (`type: "Macro"`). Compiled `packs/` LevelDB is a gitignored build artifact — commit only the YAML; the pack is built via `scripts/pack-compendium.mjs` (`compilePack`).

**Patterns to follow:** existing pack registration entries in `system.json`; existing macro/script item YAML shape under `src/packs/`.

**Test scenarios:** `Test expectation: none -- Foundry macros + chat output; the underlying table mapping is covered by U1. Covered by AE3 manual check.`

**Verification:** Covers AE3. Running each macro with no token selected posts the correct location roll (1d12 vs Mythras 1d20) to chat.

---

## Scope Boundaries

**In scope:** Mythras below-zero location, full `wounds` removal, below-zero injury-Item persistence, the two-macro compendium, and the NPC injuries header.

### Deferred to Follow-Up Work
- Sheet UI for editing an `injury` Item's fields beyond what the item sheet already offers.
- Surfacing other injury stats on the NPC header (only `injuries` is in scope).

### Out of Scope (unchanged)
- Below-zero severity formula, edge/TN math, pressure model, idempotency/provenance machinery.
- The above-zero threshold workflow and its 1d12 location.
- Any new death/defeat trigger to replace `wounds` (none — `injuries` is the sole track).

---

## Risks & Dependencies

- **Mythras table fidelity.** Port the wwn 1d20 ranges and result/details text exactly; an off-by-one range boundary is the most likely defect — pinned by U1 boundary tests.
- **Residual `wounds` references.** A missed `system.wounds` read elsewhere would surface as `undefined`; mitigate with a repo-wide grep in U4 verification.
- **Pack registration.** A malformed `system.json` Macro-pack entry or a YAML schema error blocks world load; validate the YAML parses and the pack compiles before commit.
- **`_getInjuryEffectDescription` coupling.** Its severity≥16 "additional wounds" narrative referenced the counter; reconcile the text so it doesn't imply a tracked value that no longer exists.

---

## Verification Strategy

- `npm test` (`node --test tests/node/*.test.mjs`) — new `injury-locations.test.mjs` covers both tables' boundaries; existing injury/attack tests stay green.
- Manual Foundry check (per AEs) — below-zero produces a Mythras location + persisted injury Item + `injuries++` with no `wounds`; character and NPC headers show only `injuries`; the two macros post correct rolls; an above-zero threshold injury still uses 1d12.

---

## Git / Delivery Notes

TTRPG repo (configured in this worktree): commit/push as **bunnysage** to the **`bunnysage`** remote (`origin` is upstream `wintersleepAI`); PR fork-only with base **`dev`**, head **`feat/injury-mythras-location`**. The compiled `packs/` LevelDB is gitignored — commit only the `src/packs/swnr-macros/*.yml` source.
