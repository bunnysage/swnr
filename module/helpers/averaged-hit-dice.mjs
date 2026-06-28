/**
 * Pure, Foundry-free transform for the "Averaged Hit Dice" world setting.
 *
 * When the setting is enabled, every hit die in a hit-dice HP roll is replaced
 * by two dice of half its size (`d6` -> `2d3`, `d8` -> `2d4`, ...) so HP totals
 * cluster toward the middle of their range (a bell-ish distribution) instead of
 * swinging across the full die. This intentionally raises each die's minimum
 * from 1 to 2 and its average by +0.5 while leaving the maximum unchanged.
 *
 * This module owns the mapping table and the parsing/classification logic so it
 * can be unit tested without a live Foundry. Callers (the character and NPC data
 * models) own reading the world setting, building the `Roll`, and firing
 * `ui.notifications` — keeping this function side-effect-free.
 */

/**
 * Supported hit-die sizes, keyed by original die size, mapped to the half-die
 * each splits into. A miss in this table is what defines an "unsupported" die.
 * @type {Record<number, string>}
 */
export const AVERAGED_HIT_DIE_MAP = {
  4: "d2",
  6: "d3",
  8: "d4",
  10: "d5",
  12: "d6",
};

/** Matches a bare `NdX` die term with an optional leading count (default 1). */
const DIE_TERM_REGEX = /^(\d*)d(\d+)$/i;

/**
 * @typedef {Object} AveragedHitDiceResult
 * @property {"transformed"|"unsupported"|"not-a-die"} status
 *   - `transformed`: a supported die was rewritten; use `formula`.
 *   - `unsupported`: a parseable die outside the supported set; `formula` is
 *     unchanged and the caller should notify + roll the original.
 *   - `not-a-die`: the input is not an `NdX` die (flat HP, empty, null); leave
 *     it untouched with no notification.
 * @property {string} original   The input string, unchanged.
 * @property {string} formula    The form to roll: rewritten when `transformed`,
 *                               otherwise identical to `original`.
 * @property {string|null} label Human label for flavor text, e.g.
 *                               `"2d3 (averaged d6)"`. Null unless `transformed`.
 */

/**
 * Rewrite a die-bearing string into its averaged form.
 *
 * @param {string} dieString A die or formula term such as `"d6"`, `"3d8"`,
 *   `"15"` (a flat HP value), or `""`.
 * @returns {AveragedHitDiceResult}
 */
export function averageHitDie(dieString) {
  const original = dieString == null ? "" : String(dieString);
  const trimmed = original.trim();

  const match = DIE_TERM_REGEX.exec(trimmed);
  if (!match) {
    return { status: "not-a-die", original, formula: original, label: null };
  }

  const count = match[1] === "" ? 1 : parseInt(match[1], 10);
  const size = parseInt(match[2], 10);
  const halfDie = AVERAGED_HIT_DIE_MAP[size];

  if (!halfDie) {
    return { status: "unsupported", original, formula: original, label: null };
  }

  const formula = `${count * 2}${halfDie}`;
  const sourceDie = `${count === 1 ? "" : count}d${size}`;
  const label = `${formula} (averaged ${sourceDie})`;
  return { status: "transformed", original, formula, label };
}
