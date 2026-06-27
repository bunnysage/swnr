---
title: "feat: Injury display cleanup — names, severity, cards, effect text"
type: feat
date: 2026-06-27
status: ready
branch: feat/injury-display-cleanup
origin: docs/brainstorms/2026-06-27-injury-display-cleanup-requirements.md
---

# feat: Injury display cleanup

## Summary

Presentation-only cleanup of the injury system (PR #5): generic injury names, one-word severity labels, slimmed chat cards, and removal of the prescriptive mechanical-effect text everywhere. No mechanics change. (See origin: `docs/brainstorms/2026-06-27-injury-display-cleanup-requirements.md`.)

**Target repo:** swnr (worktree on `feat/injury-display-cleanup`, PR base `dev`).

---

## Problem Frame

Injuries currently read `Severe Injury: Chest` with a `Severe Threshold Injury` severity column (severity stated twice, "Threshold Injury" is noise), and the chat card prescribes a fixed mechanical effect plus a trailing HP line. The desired record is minimal and non-prescriptive: name, location, severity, roll — the GM adjudicates consequences.

---

## Requirements

- **R1** — Injury Item name is `{Location} Injury` (drop the severity prefix); both creation paths.
- **R2** — `injurySeverityTypes` labels become one word: Minor / Moderate / Serious / Severe (keys unchanged).
- **R3** — No prescriptive effect text generated or stored; the effect-text generator is deleted and `mechanicalEffect` is left empty.
- **R4** — All three injury chat cards show only: injury name (title), location, severity, severity roll. Remove the effect box, the "now at X HP" line, and the injuries-counter row.
- **R5** — The sheet's expandable injury row shows just the location.

### Acceptance Examples (from origin)

- **AE1** — A below-zero chest injury → Item named "Chest Injury"; sheet severity column reads "Severe".
- **AE2** — The card shows title "Chest Injury", location, "Severity 14", the `1d12 … = 14` roll, and nothing else.
- **AE3** — Expanding the injury on the sheet shows just "Chest".
- **AE4** — The crit and threshold cards follow the same slimmed format.

---

## Key Technical Decisions

- **KTD1 (OQ1) — Injury name replaces the banner text.** The existing red skull-crossbones banner stays as the styled header, but its text becomes the injury name (`{Location} Injury`) instead of the generic "CRITICAL INJURY!". The red styling already conveys severity. Each card receives an `injuryName` value in its chat data.
- **KTD2 (OQ2) — Delete `_getInjuryEffectDescription` outright.** After R3/R4 it has no callers; remove it rather than leaving it dormant. The `mechanicalEffect` is set to `""` at Item creation.
- **KTD3 — Construct the title name from location for all three cards.** `applyCriticalInjury` does not create an injury Item, so its card has no Item name; build the same `{Location} Injury` string for its title for consistency.
- **KTD4 — Keep the `mechanicalEffect` schema field.** Emptied, not removed — it stays available for manual GM entry (no data-model change, no migration).

---

## Implementation Units

### U1. Injury naming + remove effect generation/storage

**Goal:** Generic injury names; no generated/stored effect text.
**Requirements:** R1, R3.
**Dependencies:** none.
**Files:**
- `module/documents/actor.mjs` (modify — `applyWounds`, `applyThresholdInjury`, `applyCriticalInjury`; delete `_getInjuryEffectDescription`)

**Approach:** Change both injury-Item `itemName` constructions from `${capitalizedLabel} Injury: ${location}` to `${location} Injury` (e.g. "Chest Injury", "Right Arm Injury"). At Item creation, set `mechanicalEffect: ""` and `description: ""` (no generated effect). Remove every call to `_getInjuryEffectDescription` and delete the method. In each of the three `apply*` methods, add an `injuryName` (= `${location} Injury`) to the chat data for the card title, and stop passing `effectDescription` / the now-unused counter + status fields (see U3 for what each card still needs).

**Patterns to follow:** existing `itemName` construction in `applyWounds` / `applyThresholdInjury`.

**Test scenarios:** `Test expectation: none at node level — Foundry-bound Item/chat creation. Covered by AE1/AE3 manual check + existing 47 tests staying green (location helpers untouched).`

**Verification:** Covers AE1, AE3. Below-zero chest hit → Item "Chest Injury" with empty `mechanicalEffect`; no `_getInjuryEffectDescription` reference remains (grep); `npm test` green.

---

### U2. One-word severity labels

**Goal:** Severity reads "Severe", not "Severe Threshold Injury".
**Requirements:** R2.
**Dependencies:** none.
**Files:**
- `lang/en.json` (modify the four `injurySeverityTypes` label values)

**Approach:** Change `thresholdMinor`→"Minor", `thresholdModerate`→"Moderate", `thresholdSerious`→"Serious", `thresholdSevere`→"Severe". Keys unchanged, so the sheet severity column and the threshold card label update automatically.

**Patterns to follow:** existing `lang/en.json` `injurySeverityTypes` block.

**Test scenarios:** `Test expectation: none — localization string change; JSON must stay valid.`

**Verification:** Covers AE1. Sheet severity column and threshold card show the single word; `en.json` parses.

---

### U3. Slim the three injury chat cards

**Goal:** Cards show only name (title), location, severity, roll.
**Requirements:** R4, R5.
**Dependencies:** U1 (chat data now carries `injuryName`, no `effectDescription`).
**Files:**
- `templates/chat/wound-roll.hbs` (modify)
- `templates/chat/critical-injury.hbs` (modify)
- `templates/chat/threshold-injury-roll.hbs` (modify)

**Approach:** In each card: set the banner/header text to `{{injuryName}}` (KTD1); keep the location block, the severity heading, and the dice-roll breakdown; remove the `effect-description` block, the `actor-status` ("now at … HP") block, and the `counters-update` injuries-row. The injury-list expandable row (`templates/actor/fragments/injury-list.hbs`) already renders `{{item.system.mechanicalEffect}}` after the location — with `mechanicalEffect` now empty (U1), it shows just the location (R5), so no template change is required there (confirm it renders cleanly with an empty effect).

> Note: `wound-roll.hbs` is CRLF? No — it is LF; only `templates/actor/header.hbs` is CRLF in this repo. Standard edits are fine here.

**Patterns to follow:** the current card structure (banner / injury-location / severity-section / dice-formula).

**Test scenarios:** `Test expectation: none — Handlebars template changes; covered by AE2/AE4 manual check in Foundry.`

**Verification:** Covers AE2, AE4. Each injury card renders title + location + severity + roll only; no effect box, HP line, or injuries row; the sheet expandable shows just the location.

---

## Scope Boundaries

**In scope:** injury naming, severity labels, effect-text removal, the three chat cards, and the sheet expandable (via empty `mechanicalEffect`).

### Out of Scope (unchanged)
- All injury **mechanics** — severity math, location tables, edge/TN/pressure, the `injuries` counter, persistence.
- The `mechanicalEffect` **schema field** (emptied, not removed; no migration).
- The location-roller macros.

---

## Risks & Dependencies

- **Residual `effectDescription` / `_getInjuryEffectDescription` references.** A missed reference would render `undefined` or break a card; mitigate with a repo-wide grep in U1/U3 verification.
- **Empty `mechanicalEffect` rendering.** Confirm the injury-list expandable row reads cleanly with an empty effect (just the location, no dangling separator).
- **Card data drift.** Each `apply*` method feeds a different chat-data shape; ensure each card only references fields its method still provides after the trims.

---

## Verification Strategy

- `npm test` — existing 47 stay green (no pure logic changed).
- Manual Foundry check (per AEs) — below-zero and crit/threshold cards render the slimmed format; sheet shows "Chest Injury" + "Severe" + location-only expand.

---

## Git / Delivery Notes

TTRPG repo (configured in this worktree): commit/push as **bunnysage** to the **`bunnysage`** remote (`origin` is upstream); PR fork-only with base **`dev`**, head **`feat/injury-display-cleanup`**.
