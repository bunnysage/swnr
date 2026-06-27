/**
 * Pure, Foundry-free aggregation of feature-granted combat bonuses.
 *
 * Features (foci, edges, abilities) may declare `bonusesGranted` entries that
 * add formula-driven values to an actor's damage, shock, or attack rolls. This
 * module owns the summing / fan-out / condition-gating logic so it can be unit
 * tested without a live Foundry, mirroring `injury-thresholds.mjs`.
 *
 * The Foundry-bound concerns — gathering feature items and evaluating formulas
 * through `Roll` — live in `data/actors/base-actor.mjs`, which injects the
 * `evaluateFormula` / `evaluateCondition` callbacks used here.
 */

/** @returns {{ meleeDamage: number, rangedDamage: number, shock: number, attack: number }} */
export function createEmptyFeatureBonuses() {
  return { meleeDamage: 0, rangedDamage: 0, shock: 0, attack: 0 };
}

/**
 * Sum a list of `bonusesGranted` entries into derived combat-bonus totals.
 *
 * Routing:
 * - `allDamage` fans out to BOTH `meleeDamage` and `rangedDamage`.
 * - `meleeDamage` / `rangedDamage` / `shock` / `attack` add to their own bucket.
 * - `appliesToShock` ALSO adds the value to `shock`, except when the target is
 *   already `shock` (the flag is a no-op there — no double count).
 * - An entry with a non-empty `condition` is skipped when `evaluateCondition`
 *   returns false.
 *
 * @param {Array<object>} entries - flattened bonus entries from feature items
 * @param {object} evaluators
 * @param {(formula: string) => number} evaluators.evaluateFormula
 * @param {(condition: string) => boolean} evaluators.evaluateCondition
 * @returns {{ meleeDamage: number, rangedDamage: number, shock: number, attack: number }}
 */
export function aggregateFeatureBonuses(entries, { evaluateFormula, evaluateCondition } = {}) {
  const totals = createEmptyFeatureBonuses();
  if (!Array.isArray(entries)) return totals;

  const evalFormula = typeof evaluateFormula === "function" ? evaluateFormula : () => 0;
  const evalCondition = typeof evaluateCondition === "function" ? evaluateCondition : () => true;

  for (const entry of entries) {
    if (!entry) continue;

    if (entry.condition && !evalCondition(entry.condition)) continue;

    let value = Number(evalFormula(entry.formula));
    if (!Number.isFinite(value)) value = 0;
    // A zero bonus is a no-op for every bucket, including appliesToShock — skip.
    if (value === 0) continue;

    let matched = true;
    switch (entry.target) {
      case "meleeDamage":
        totals.meleeDamage += value;
        break;
      case "rangedDamage":
        totals.rangedDamage += value;
        break;
      case "allDamage":
        // Routing alias — not an output key; fans out to both damage buckets.
        totals.meleeDamage += value;
        totals.rangedDamage += value;
        break;
      case "shock":
        totals.shock += value;
        break;
      case "attack":
        totals.attack += value;
        break;
      default:
        matched = false;
        break;
    }

    // appliesToShock layers shock damage on top of the primary target, but is a
    // no-op when the target is already shock (avoids double-counting) or when the
    // target was unrecognized (so an unknown target can't leak into shock).
    if (matched && entry.appliesToShock && entry.target !== "shock") {
      totals.shock += value;
    }
  }

  return totals;
}
