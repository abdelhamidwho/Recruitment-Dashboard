import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { matchesTerm } from "../matching";
import { WEIGHTS } from "../weights";
import type { RuleResult } from "../types";
import { textFields } from "./textFields";

/**
 * Requested job titles are alternatives (OR), matching how
 * `buildBooleanQuery` treats them — a candidate need only match one to get
 * full credit, not a fraction per title. Searches `currentTitle`,
 * `headline`, and past job titles (not a structured-only lookup), since
 * GitHub candidates have no `currentTitle` field at all but often state
 * their role in their bio.
 */
export function scoreTitles(candidate: Candidate, filters: Partial<SearchFilters>): RuleResult {
  const titles = (filters.titles ?? []).map((t) => t?.trim()).filter((t): t is string => Boolean(t));
  if (titles.length === 0) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const fields = textFields(candidate);
  const matched = titles.find((title) => matchesTerm(title, { textFields: fields }).matched);

  if (matched) {
    return {
      earned: WEIGHTS.titles,
      maxPoints: WEIGHTS.titles,
      evidence: [{ label: `Title/headline matches requested title "${matched}"`, points: WEIGHTS.titles }],
    };
  }

  return {
    earned: 0,
    maxPoints: WEIGHTS.titles,
    evidence: [{ label: `Title/headline matches none of the requested titles (${titles.join(", ")})`, points: 0 }],
  };
}
