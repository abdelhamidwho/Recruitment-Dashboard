import type { NormalizedProfile } from "@/lib/normalize";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { WEIGHTS } from "../weights";
import type { RuleResult } from "../types";
import { allUnsupported, unsupportedFieldsFor } from "../sourceSupport";

/**
 * `filters.industry` is OR — any requested industry matching the
 * candidate's normalized industry earns full weight. Skipped entirely when
 * the source cannot supply industry at all (e.g. GitHub), rather than
 * scored as a miss for every candidate from that source.
 */
export function scoreIndustry(
  normalized: NormalizedProfile,
  filters: Partial<SearchFilters>,
  sourceId?: string | null,
): RuleResult {
  const requested = (filters.industry ?? []).map((i) => i?.trim()).filter((i): i is string => Boolean(i));
  if (requested.length === 0) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const unsupported = unsupportedFieldsFor(sourceId);
  if (allUnsupported(unsupported, ["industry"])) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const industry = normalized.industry;
  const match = industry && requested.find((r) => r.toLowerCase() === industry.toLowerCase());

  if (match) {
    return {
      earned: WEIGHTS.industry,
      maxPoints: WEIGHTS.industry,
      evidence: [{ label: `Industry "${industry}" matches requested industry`, points: WEIGHTS.industry }],
    };
  }

  return {
    earned: 0,
    maxPoints: WEIGHTS.industry,
    evidence: [
      {
        label: industry
          ? `Industry "${industry}" does not match requested (${requested.join(", ")})`
          : "Industry unknown",
        points: 0,
      },
    ],
  };
}
