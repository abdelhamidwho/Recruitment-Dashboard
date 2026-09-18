import type { NormalizedProfile } from "@/lib/normalize";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { WEIGHTS } from "../weights";
import type { RuleResult } from "../types";
import { allUnsupported, unsupportedFieldsFor } from "../sourceSupport";

/**
 * Spoken languages, split evenly across however many were requested (same
 * partial-credit approach as nice-to-have skills). Matched by name only,
 * case-insensitively — proficiency level is not compared against anything
 * the filter shape currently expresses. Skipped entirely when the source
 * cannot supply spoken languages at all (e.g. GitHub).
 */
export function scoreLanguages(
  normalized: NormalizedProfile,
  filters: Partial<SearchFilters>,
  sourceId?: string | null,
): RuleResult {
  const requested = (filters.languages ?? []).map((l) => l?.trim()).filter((l): l is string => Boolean(l));
  if (requested.length === 0) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const unsupported = unsupportedFieldsFor(sourceId);
  if (allUnsupported(unsupported, ["languages"])) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const known = new Set(normalized.languages.map((l) => l.name.toLowerCase()));
  const perLanguage = WEIGHTS.languages / requested.length;

  const evidence = requested.map((lang) => {
    if (known.has(lang.toLowerCase())) {
      return { label: `Speaks requested language "${lang}"`, points: perLanguage };
    }
    return { label: `No record of speaking "${lang}"`, points: 0 };
  });

  const earned = evidence.reduce((sum, e) => sum + e.points, 0);
  return { earned, maxPoints: WEIGHTS.languages, evidence };
}
