import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { matchesTerm } from "../matching";
import { WEIGHTS } from "../weights";
import type { RuleResult } from "../types";
import { textFields } from "./textFields";

/**
 * Nice-to-have skills only. Must-have skills are a hard gate
 * (`src/lib/scoring/gates.ts`) — every surviving candidate already has all
 * of them, so scoring them again here would just add a constant to every
 * candidate and contribute nothing to the ranking.
 *
 * `WEIGHTS.niceToHaveSkills` is split evenly across however many
 * nice-to-have skills were requested, so a candidate matching 2 of 3 nets
 * two-thirds of the weight rather than an all-or-nothing bonus.
 *
 * Matching searches `skills`, `headline`, `summary`, `currentTitle`, and
 * past job titles (see `textFields`) — not just the structured `skills`
 * array — because a source like GitHub has no skills list at all but often
 * mentions technologies in its bio.
 */
export function scoreNiceToHaveSkills(candidate: Candidate, filters: Partial<SearchFilters>): RuleResult {
  const niceToHave = (filters.niceToHave ?? []).map((s) => s?.trim()).filter((s): s is string => Boolean(s));
  if (niceToHave.length === 0) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const perSkill = WEIGHTS.niceToHaveSkills / niceToHave.length;
  const evidence = niceToHave.map((skill) => {
    const result = matchesTerm(skill, { skills: candidate.skills, textFields: textFields(candidate) });
    if (result.matched) {
      return { label: `Has nice-to-have skill "${skill}" (in ${result.where.join(", ")})`, points: perSkill };
    }
    return { label: `Missing nice-to-have skill "${skill}"`, points: 0 };
  });

  const earned = evidence.reduce((sum, e) => sum + e.points, 0);
  return { earned, maxPoints: WEIGHTS.niceToHaveSkills, evidence };
}
