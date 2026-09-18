import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { matchesTerm } from "../matching";
import { textFields } from "./textFields";

/**
 * Checks `filters.exclude` keywords against title, skills, headline, and
 * summary — not just `summary`/`headline` as the old scorer did, which let
 * an excluded word sitting in the job title (e.g. "Intern") sail through
 * untouched. Used by `gates.ts` to remove a matching candidate outright,
 * per spec ("a hit on an excluded keyword removes a candidate rather than
 * costing points") — this module only detects the hit; gates.ts decides
 * what to do with it.
 */
export function findExclusionHits(candidate: Candidate, filters: Partial<SearchFilters>): string[] {
  const terms = (filters.exclude ?? []).map((t) => t?.trim()).filter((t): t is string => Boolean(t));
  if (terms.length === 0) return [];

  const fields = textFields(candidate);
  const hits: string[] = [];

  for (const term of terms) {
    const result = matchesTerm(term, { skills: candidate.skills, textFields: fields });
    if (result.matched) {
      hits.push(`Contains excluded keyword "${term}" (in ${result.where.join(", ")})`);
    }
  }

  return hits;
}
