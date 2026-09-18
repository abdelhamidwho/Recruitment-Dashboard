import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { normalizeProfile } from "@/lib/normalize";
import { applyGates } from "./gates";
import { scoreNiceToHaveSkills } from "./rules/skills";
import { scoreTitles } from "./rules/titles";
import { scoreSeniority } from "./rules/seniority";
import { scoreLocation } from "./rules/location";
import { scoreEducation } from "./rules/education";
import { scoreLanguages } from "./rules/languages";
import { scoreIndustry } from "./rules/industry";
import { NEUTRAL_FALLBACK_SCORE } from "./weights";
import type { Evidence, RuleResult } from "./types";

export type { Evidence, RuleResult, GateCheck } from "./types";
export { applyGates } from "./gates";

/**
 * Sentinel persisted to `SearchRunPerson.score` for a gated (excluded)
 * candidate. `score` is otherwise always 0-100, so this negative value is
 * unambiguous and lets callers filter it out of the ranked list (and count
 * it) without a schema change to add a dedicated column. See
 * `src/lib/profileStorage.ts` (`recordAppearance`) and
 * `src/app/api/search/[searchRunId]/route.ts` for where it's written and
 * read.
 */
export const GATED_SCORE_SENTINEL = -1;

export interface ScoreResult {
  /** 0-100. Meaningless (always 0) when `gated` is true — callers must
   * check `gated` rather than treat a low score as "gated". */
  score: number;
  /** True when the candidate failed a hard gate (missing must-have skill,
   * or an excluded keyword hit) and should be removed from the result set
   * rather than ranked. See `src/lib/scoring/gates.ts`. */
  gated: boolean;
  /** Human-readable lines, one per gate reason (if gated) or one per rule's
   * evidence item (if not) — includes neutral/zero-point lines too, so a
   * miss is as visible as a hit. This is what the "why this score?" UI
   * panel renders directly; it never re-derives reasons on its own. */
  breakdown: string[];
  /** Structured form of the same evidence `breakdown` renders as text. */
  evidence: Evidence[];
}

function formatPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "" : "+"; // negative already carries its own "-"
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${sign}${text}`;
}

function toBreakdownLines(results: RuleResult[]): { breakdown: string[]; evidence: Evidence[] } {
  const evidence = results.flatMap((r) => r.evidence);
  const breakdown = evidence.map((e) => `${formatPoints(e.points)}: ${e.label}`);
  return { breakdown, evidence };
}

/**
 * Scores one candidate against the given search filters, returning both a
 * final 0-100 score and the line-by-line evidence behind it.
 *
 * Two-phase design (see `docs/superpowers/specs/.../design.md`, "Scoring"):
 * 1. **Gates** (`applyGates`) — hard requirements. A missing must-have
 *    skill or an excluded-keyword hit removes the candidate outright
 *    (`gated: true`); soft scoring never runs for a gated candidate.
 * 2. **Soft scoring** — each `rules/*.ts` dimension returns points earned
 *    out of a max that only counts dimensions applicable to this
 *    search+candidate+source (see `RuleResult.maxPoints` and
 *    `sourceSupport.ts`). The final score is
 *    `round(100 * totalEarned / totalApplicableMax)`, normalized so a
 *    search that only sets two filters is still scored out of 100 rather
 *    than out of a fraction of a fixed budget — and so a source that can't
 *    supply a field (e.g. GitHub + education) never drags every one of its
 *    candidates toward a lower score for data that was never available.
 *
 * `sourceId` (e.g. "github") is optional so this remains callable with
 * exactly the old two-argument shape; omitting it is equivalent to scoring
 * a source that can supply every field (see `unsupportedFieldsFor`).
 */
export function scoreCandidate(
  candidate: Candidate,
  filters: Partial<SearchFilters>,
  sourceId?: string | null,
): ScoreResult {
  const gate = applyGates(candidate, filters);
  if (!gate.passed) {
    return {
      score: 0,
      gated: true,
      breakdown: gate.reasons.map((r) => `EXCLUDED: ${r}`),
      evidence: gate.reasons.map((r) => ({ label: r, points: 0 })),
    };
  }

  const normalized = normalizeProfile(candidate);

  const results: RuleResult[] = [
    scoreNiceToHaveSkills(candidate, filters),
    scoreTitles(candidate, filters),
    scoreSeniority(candidate, normalized, filters, sourceId),
    scoreLocation(normalized, filters),
    scoreEducation(normalized, filters, sourceId),
    scoreLanguages(normalized, filters, sourceId),
    scoreIndustry(normalized, filters, sourceId),
  ];

  const totalEarned = results.reduce((sum, r) => sum + r.earned, 0);
  const totalMax = results.reduce((sum, r) => sum + r.maxPoints, 0);

  const { breakdown, evidence } = toBreakdownLines(results);

  if (totalMax <= 0) {
    breakdown.push(`+0: No scoring criteria applied to this candidate — showing a neutral baseline`);
    return { score: NEUTRAL_FALLBACK_SCORE, gated: false, breakdown, evidence };
  }

  const score = Math.max(0, Math.min(100, Math.round((100 * totalEarned) / totalMax)));
  return { score, gated: false, breakdown, evidence };
}
