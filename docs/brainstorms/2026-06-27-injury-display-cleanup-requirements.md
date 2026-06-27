# Requirements: Injury display cleanup (names, severity, cards, effect text)

**Date:** 2026-06-27
**Target repo:** swnr (branch off `dev`)
**Status:** ready for planning

## Summary

A presentation cleanup of the injury system shipped in PR #5. The injury Item names, the severity label, and the injury chat cards are noisy and over-prescriptive. This pares them down to the essentials — name, location, severity, roll — and stops the system from dictating mechanical consequences (the GM adjudicates).

## Problem / Motivation

On the sheet, injuries read as `Severe Injury: Chest` with a severity column of `Severe Threshold Injury` — the severity is stated twice and "Threshold Injury" is noise. On the chat card, a yellow warning box prescribes the exact mechanical effect ("Blood Loss… Max HP reduced by 1 per HD… falls unconscious…") and a trailing "*name* now at X HP" line — both unwanted. The intent is a clean, non-prescriptive injury record: what got hurt and how badly, nothing more.

## Requirements

- **R1 — Generic injury Item name.** The injury Item name is `{Location} Injury` (e.g. "Chest Injury", "Right Arm Injury", "Head Injury") — drop the severity/threshold prefix. Applies to both creation paths (below-zero `applyWounds` and threshold `applyThresholdInjury`).
- **R2 — One-word severity label.** The `injurySeverityTypes` display labels become a single word — `Minor` / `Moderate` / `Serious` / `Severe` (strip "Threshold Injury"). Keys (`thresholdMinor`…`thresholdSevere`) are unchanged. This is the label shown in the sheet severity column and on the threshold card.
- **R3 — No prescriptive effect text, anywhere.** Stop generating and storing the mechanical-effect text. The injury records location + severity only; the GM adjudicates the consequence. The effect-text generator is removed; the injury Item's `mechanicalEffect` is left empty (the field stays for optional manual GM use).
- **R4 — Slimmed injury chat cards.** Each injury chat card shows only: the **injury name as the title**, the **location** (with its detail), the **severity**, and the **severity roll** (dice breakdown). Remove the effect-description warning box, the "*name* now at X HP" status line, and the "Injuries: 0 → 1" counter row. Apply this to **all three** injury cards (below-zero wound, above-zero crit, threshold) for consistency.
- **R5 — Sheet expandable shows location only.** With `mechanicalEffect` empty, the injury-list expandable row shows just the location (no prescribed effect).

### Acceptance examples

- **AE1** — A below-zero chest injury creates an Item named **"Chest Injury"**; the sheet severity column reads **"Severe"** (not "Severe Threshold Injury").
- **AE2** — The injury chat card shows: title "Chest Injury", "Location: Chest (Includes upper torso and back)", "Severity 14", and the `1d12: [11] + … = 14` roll — and **nothing else** (no effect box, no HP line, no injuries counter).
- **AE3** — Expanding the injury on the sheet shows just "Chest" — no prescribed mechanical effect.
- **AE4** — The above-zero crit card and the threshold card follow the same slimmed format.

## Scope boundaries

**In scope:** injury Item naming, the severity display labels, removing the effect-text generation/storage, and slimming all three injury chat cards.

**Out of scope / unchanged:**
- Injury mechanics — severity math, location tables, the edge/TN/pressure model, `injuries` counter, persistence. Only presentation and the (now-removed) effect text change.
- The `mechanicalEffect` schema field stays (emptied, available for manual GM entry); no data-model field removal.
- The standalone location-roller macros.

## Open questions (for planning)

- **OQ1 — Card title styling.** The cards currently lead with a red "CRITICAL INJURY!" banner. Decide whether the injury name replaces that banner text, sits alongside it, or the banner stays as a styled header above the name. (Presentation detail — the requirement is that the name appears as the card's title.)
- **OQ2 — `_getInjuryEffectDescription` removal vs. neutralize.** Confirm the generator is deleted outright (no remaining callers after R3/R4) rather than left dormant.
