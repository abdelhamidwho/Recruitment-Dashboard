/** One awarded/withheld point (or a neutral note) with the plain-language
 * reason behind it. This is the unit of "evidence" the why-this-score panel
 * renders — nothing in the UI re-derives a reason the scorer didn't produce. */
export interface Evidence {
  /** Plain-English line, e.g. `Has nice-to-have skill "PostgreSQL" (in skills)`. */
  label: string;
  /** Points this line contributed. 0 for a neutral/informational line
   * (e.g. "experience unknown — source does not report it"). */
  points: number;
}

/** Result of one soft-scoring dimension (rules/*.ts). `maxPoints` is 0 when
 * the dimension did not apply to this search+candidate+source combination
 * (no filter criteria for it, or the source can't supply the data it
 * needs) — such dimensions are left out of both the numerator and the
 * denominator in `scoreCandidate`, rather than counted as a miss. */
export interface RuleResult {
  earned: number;
  maxPoints: number;
  evidence: Evidence[];
}

/** Result of one hard gate (gates.ts / rules/exclusions.ts). A candidate
 * that fails any gate is removed from the result set entirely — the reasons
 * are still surfaced to the caller so exclusion is visible, not silent. */
export interface GateCheck {
  passed: boolean;
  reasons: string[];
}
