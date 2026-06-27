# Requirements: Mythras below-zero location, wounds-counter removal, location macros

**Date:** 2026-06-27
**Target repo:** swnr (branch off `dev`)
**Status:** ready for planning

## Summary

Three related changes to the swnr **death & dismemberment / injury** system:

1. The **below-zero** wound path rolls a **Mythras 1d20 hit location** (as the wwn original does) instead of the shared 1d12. The above-zero paths keep their 1d12.
2. The **`wounds` counter is removed entirely**; the single `injuries` counter becomes the sole carried-wound track.
3. A new **Macros compendium** ships two GM convenience macros that roll the two location tables standalone to chat.

These move swnr's below-zero behavior closer to the wwn model (anatomical Mythras location) while simplifying the consequence model down to one counter.

## Problem / Motivation

- The below-zero path currently shares a coarse 1d12 location table with the above-zero paths. The wwn lineage uses a richer **Mythras 1d20** anatomical table for downed characters; the two tables were always meant to differ (light 1d12 flavor above zero, anatomical 1d20 below zero).
- The **`wounds`** counter is a second accumulating track parallel to `injuries`, with no death/defeat logic depending on it (verified — it is a pure display counter). It adds bookkeeping without a payoff and is being cut.
- GMs want to roll either location table on demand, independent of an actual attack resolution.

## Current state (verified)

- One shared `_rollInjuryLocation()` (1d12 → arm/leg/torso/head + L/R) feeds **all three** paths: threshold (above zero), `applyCriticalInjury` (above-zero crit), and `applyWounds` (below zero). — `module/documents/actor.mjs:159`
- `applyWounds` today **only** updates `system.injuries` + `system.wounds` and posts a chat card (`templates/chat/critical-injury.hbs`); it does **not** create an injury Item. Only the threshold path (`applyThresholdInjury`) creates a persistent `injury` Item. — `module/documents/actor.mjs:229`, `:514`
- `wounds` is wired in 8 places: schema (`module/data/actors/base-actor.mjs:63`), `_calculateWoundThresholds` (`module/documents/actor.mjs:141`), `applyWounds` and `applyCriticalInjury` (both update `system.wounds`), a chat-template row (`templates/chat/critical-injury.hbs:37`), and an **editable sheet-header field** (`templates/actor/header.hbs:229`). No death trigger keys on it.
- wwn's Mythras 1d20 table to port lives at `wwn/module/actor/types/character.mjs:307`.
- No Macro compendium exists in swnr (`src/packs/` + `system.json` have none).

## Requirements

- **R1 — Mythras location for below-zero only.** `applyWounds` rolls a Mythras 1d20 hit-location table (ported from wwn). The threshold and above-zero-crit paths continue to use the existing 1d12 table. The two tables remain distinct by design.
- **R2 — Below-zero persists an injury Item.** On a below-zero hit, `applyWounds` creates a persistent `injury` Item (Mythras location + severity), increments `injuries` by 1, and posts the GM chat card. The below-zero **severity math is unchanged**: `1d12 + 2×injuries + excess − critResistance`.
- **R3 — Remove the `wounds` counter everywhere.** Delete the schema field, the editable sheet-header field, the chat-template `wounds` row, `_calculateWoundThresholds`, and every `system.wounds` read/write. No deprecation path — `dev` is unreleased homebrew; a clean removal (and a one-time cleanup of the stored field) is acceptable.
- **R4 — Above-zero crit path also drops wounds.** `applyCriticalInjury` stops touching `wounds` and tracks only `injuries`. (Framed as a below-zero change, but `wounds` removal necessarily reaches this path too.)
- **R5 — Two location macros in a new Macros compendium.** Add a Macro compendium pack (registered in `system.json`, sourced under `src/packs/`) containing:
  - **Roll Threshold Injury Location** — rolls the 1d12 above-zero table, posts the result to chat.
  - **Roll Death & Dismemberment Location** — rolls the Mythras 1d20 below-zero table, posts the result to chat.
  Macros are standalone GM tools (no actor/attack required).

- **R6 — Injury display on sheets.**
  - The **injury-Item list** (`templates/actor/fragments/injury-list.hbs`) already renders on both the character (Combat tab) and NPC (3rd column) sheets via the shared `context.injuryItems`. The below-zero injury Items from R2 therefore appear automatically — no new list wiring required.
  - The character header's paired **"Inj/Wnd"** field (`templates/actor/header.hbs:215`) collapses to a single **`injuries`** field (relabel accordingly) once `wounds` is gone.
  - **Surface the `injuries` counter on the NPC header too.** `header.hbs` is a shared sheet part already rendered for NPCs; the counter is currently gated `actor.type === 'character'`. Widen that gate to also show for `npc` (keeping the `useDeathAndDismemberment` gate) so an NPC's `injuries` value — which feeds severity pressure — is visible, not just inferable from the injury list.

## Acceptance examples

- **AE1** — A character at 3 HP takes 7 damage (below zero). `applyWounds` rolls 1d20 for a Mythras location (e.g. "Right Arm"), creates an `injury` Item recording that location + severity, increments `injuries`, posts the GM card, and changes **no** `wounds` value (the field no longer exists).
- **AE2** — Opening a character sheet shows **no** `wounds` field in the header; only `injuries` is present.
- **AE5** — Opening an NPC sheet (with death & dismemberment on) shows an `injuries` counter in the header, and below-zero injury Items appear in the NPC injury list.
- **AE3** — Running the "Roll Death & Dismemberment Location" macro with no token selected posts a Mythras 1d20 location result to chat. The "Roll Threshold Injury Location" macro posts a 1d12 result.
- **AE4** — An existing above-zero threshold injury still rolls the 1d12 location and is otherwise unchanged.

## Scope boundaries

**In scope:** the Mythras below-zero location, full `wounds` removal (schema/sheet/chat/logic across both `applyWounds` and `applyCriticalInjury`), below-zero injury-Item persistence, the two-macro compendium, and surfacing the `injuries` counter on the NPC header (R6).

**Out of scope / unchanged:**
- Below-zero severity formula, edge/TN math, pressure model, and idempotency/provenance machinery.
- The above-zero threshold workflow and its 1d12 location.
- Any new death/defeat trigger to replace `wounds` (none — `injuries` is the sole track now).

## Open questions (for planning)

- **OQ1 — Below-zero injury-Item severity band.** The `injury` Item carries a severity enum (`thresholdMinor/Moderate/Serious/Severe`). Below-zero severity is a different (higher) scale than the threshold `1d6 + pressure`. Decide whether to reuse `getThresholdSeverityBand(score)` on the below-zero score (high scores land Serious/Severe naturally) or assign below-zero injuries a fixed top band. The existing `_getInjuryEffectDescription` below-zero text can still drive `mechanicalEffect`.
- **OQ2 — Shared location source.** Prefer extracting both location tables into a Foundry-free helper (mirroring `injury-thresholds.mjs`) so the system paths **and** the macros draw from one source and stay in sync — vs. the macros duplicating the table inline. Planning decides; the shared-helper route also makes the tables unit-testable.
- **OQ3 — Stored-field cleanup.** Whether to add a tiny migration to strip `system.wounds` from existing actors, or rely on the data model dropping the unknown field on next write.
