import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { matchesTerm } from "./matching";
import { findExclusionHits } from "./rules/exclusions";
import { textFields } from "./rules/textFields";
import type { GateCheck } from "./types";

/**
 * Hard requirements, evaluated before soft scoring and kept separate from
 * it: a candidate that fails a gate is removed from the result set, not
 * merely docked points. The old scorer only cost 5 points for a missing
 * must-have, which let a candidate missing every requested skill still
 * land mid-pack; and it only checked excluded keywords against
 * `summary`/`headline`, letting one in the job title through untouched.
 *
 * `reasons` is always populated when `passed` is false, so a caller can
 * report *why* a candidate was gated rather than just dropping it silently
 * — see `unsupportedFieldsFor`'s doc comment in `sourceSupport.ts` for why
 * this matters even more for a source with sparse data: a gate failure
 * must be traceable back to a real absence of evidence, not treated as
 * mysterious.
 */
export function applyGates(candidate: Candidate, filters: Partial<SearchFilters>): GateCheck {
  const reasons: string[] = [];

  const mustHave = (filters.mustHave ?? []).map((s) => s?.trim()).filter((s): s is string => Boolean(s));
  const fields = textFields(candidate);
  for (const skill of mustHave) {
    const result = matchesTerm(skill, { skills: candidate.skills, textFields: fields });
    if (!result.matched) {
      reasons.push(`Missing must-have skill "${skill}"`);
    }
  }

  reasons.push(...findExclusionHits(candidate, filters));

  return { passed: reasons.length === 0, reasons };
}
