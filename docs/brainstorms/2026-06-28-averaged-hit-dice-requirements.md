---
date: 2026-06-28
topic: averaged-hit-dice
---

# Averaged Hit Dice (Bell-Curve HP) — Requirements

## Summary

Add a world setting that, when enabled, transforms every hit-dice HP roll
by replacing each die with two half-sized dice (`d6` → `2d3`, `d8` → `2d4`,
etc.) so HP totals cluster toward the middle of their range instead of
swinging across the full die. The setting affects both player characters
and NPCs, leaves the hit die *displayed* on sheets unchanged, and falls
back to the normal roll with a notification for any die outside the
supported set.

## Problem Frame

Single-die hit-dice rolls are highly swingy: a `d8` hit die gives any value
1–8 with equal probability, so two characters of the same class and level
can differ by up to 7 HP per level from luck alone. For tables that find
this variance too punishing, the usual fix is to manually rewrite hit dice
or houserule averages — which means changing how HP is represented
everywhere and re-teaching the table. The goal is to get the smoother HP
distribution without touching the stat blocks: keep the listed hit die as
written, and change only what happens when the dice are rolled.

## Key Decisions

- **World setting, opt-in, off by default.** The behavior is a GM-level
  toggle so a whole table shares one HP-generation rule. Default off
  preserves stock behavior for everyone who doesn't opt in. This is the one
  hard requirement the user named: it must be switchable on and off as a
  system setting.

- **Each die splits into two of half its size, averaged in count.** The
  mapping is fixed: `d4`→`2d2`, `d6`→`2d3`, `d8`→`2d4`, `d10`→`2d5`,
  `d12`→`2d6`. Two smaller dice produce a triangular (bell-ish)
  distribution instead of a flat one.

- **Accept the +0.5 mean and floor-of-2 shift.** Splitting every die raises
  its minimum from 1 to 2 and its average by exactly +0.5 (e.g. `d8` avg
  4.5 → `2d4` avg 5.0), while leaving the maximum unchanged. This is
  intrinsic to rolling two dice and is accepted as the cost of the variance
  squeeze — it is not corrected back down.

- **Transparency: show the split openly.** Confirm-dialog and chat flavor
  read as the split with its origin, e.g. "Rolling 2d3 (averaged d6)". The
  underlying Foundry dice tooltip already shows the real dice; the flavor
  matches rather than masking it.

- **Display is untouched.** The hit die shown on the character sheet and NPC
  stat block stays as authored (`d6`, `3d8`, etc.). Only the roll is
  transformed.

## Requirements

**Setting**

- R1. A world-scoped boolean system setting controls the feature. It is
  registered alongside the existing `swnr` world settings and defaults to
  off (stock rolling behavior).
- R2. When the setting is off, hit-dice rolls behave exactly as they do
  today — no transformation, no added notifications.

**Roll transformation**

- R3. When the setting is on, each supported hit die in a hit-dice HP roll
  is replaced by two dice of half its size before the roll is evaluated,
  per the fixed mapping: `d4`→`2d2`, `d6`→`2d3`, `d8`→`2d4`, `d10`→`2d5`,
  `d12`→`2d6`.
- R4. The transformation applies to player-character per-level HP rolls
  (the single-die hit-die path).
- R5. The transformation applies to NPC hit-dice HP rolls, including
  multi-die hit dice — each die in the formula is split and the count
  doubled (e.g. `3d8` → `6d4`).
- R6. Per-roll modifiers and floors that exist today are preserved around
  the transformed dice (the per-level "result cannot be less than 1" floor,
  CON modifier addition for PCs, and NPC soak handling continue to apply).

**Unsupported dice and non-dice HD**

- R7. When the setting is on but a hit die falls outside the supported set
  (d4/d6/d8/d10/d12), the roll proceeds with the original, untransformed
  die and a notification informs the user that averaging isn't configured
  for that die and the normal hit die was rolled.
- R8. NPC hit points entered as a flat value (e.g. `"15 HP"`) have no die
  to split and are left exactly as-is — no transformation and no
  notification.

**Presentation**

- R9. When a roll is transformed, the confirm-dialog text and resulting chat
  message describe the split together with the die it came from (e.g.
  "Rolling 2d3 (averaged d6)").

## Acceptance Examples

- AE1. **Covers R3, R4, R9.** A PC with a `d6` hit die and the setting on
  levels up. The confirm dialog and chat flavor reference `2d3 (averaged
  d6)`, the roll evaluates `2d3` per level (plus CON mod), and the result
  cannot fall below the existing per-level floor.
- AE2. **Covers R5.** An NPC with hit dice `3d8` and the setting on rolls
  HP. The evaluated formula is `6d4`. NPC soak (e.g. a trailing `+N`) is
  applied as it is today.
- AE3. **Covers R7.** With the setting on, a hit die of `d20` (or any
  unsupported size) is rolled. The roll uses `d20` unchanged and a
  notification states that averaging isn't set up for that die.
- AE4. **Covers R8.** An NPC whose hit dice field is `"15 HP"` rolls HP with
  the setting on. The value is taken as 15 with no split and no
  notification.
- AE5. **Covers R2.** With the setting off, the same `d6` PC and `3d8` NPC
  roll exactly as they do in stock today, with no averaging flavor text.

## Scope Boundaries

- Hit dice as *displayed* on sheets and stat blocks are not rewritten — the
  feature only changes roll evaluation.
- No new supported die sizes beyond d4/d6/d8/d10/d12; odd or exotic dice
  intentionally fall through to R7's notification path.
- No alternate averaging schemes (e.g. drop-lowest, `2dX-1` to preserve the
  original mean, or take-average-instead-of-roll). The single fixed mapping
  is the whole feature.
- Per-client variation is out of scope; the setting is world-wide so a table
  shares one rule.

## Dependencies / Assumptions

- Foundry's dice engine accepts `d2`, `d3`, and `d5` as valid die sizes for
  the halved forms. (Assumption to confirm during planning if not already
  verified.)
- PC hit die is stored as a single die string (e.g. `"d6"`); NPC hit dice is
  stored as a formula string that may be multi-die, a bare count, or a flat
  HP value. The transformation slots into each path before its roll is
  evaluated.
