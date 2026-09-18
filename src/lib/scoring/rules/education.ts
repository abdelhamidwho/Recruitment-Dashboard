import type { NormalizedProfile } from "@/lib/normalize";
import type { DegreeLevel } from "@/lib/normalize/education";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { WEIGHTS } from "../weights";
import type { RuleResult } from "../types";
import { allUnsupported, unsupportedFieldsFor } from "../sourceSupport";

/**
 * `filters.education` names a minimum degree level (e.g. "Bachelor").
 * Meeting or exceeding it earns full weight; not meeting it (or having no
 * education data at all, from a source that *can* supply education) earns
 * nothing. Skipped entirely — not scored as a miss — when the source
 * cannot supply education at all (e.g. GitHub), per
 * `unsupportedFieldsFor`: a gap the source itself created must not read as
 * "this candidate lacks the degree".
 *
 * Mirrors the rank order in `src/lib/normalize/education.ts`'s internal
 * `RANK` table (not exported, so duplicated here as a small, stable list —
 * MBA and Master share a rank there too, for the same reason: an MBA is a
 * masters-level qualification but HR may filter for it by name).
 */
const RANK: Record<DegreeLevel, number> = {
  "High school": 1,
  Diploma: 2,
  Bachelor: 3,
  Master: 4,
  MBA: 4,
  Doctorate: 5,
};

function isDegreeLevel(value: string): value is DegreeLevel {
  return Object.prototype.hasOwnProperty.call(RANK, value);
}

export function scoreEducation(
  normalized: NormalizedProfile,
  filters: Partial<SearchFilters>,
  sourceId?: string | null,
): RuleResult {
  const required = filters.education?.trim();
  if (!required) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const unsupported = unsupportedFieldsFor(sourceId);
  if (allUnsupported(unsupported, ["education"])) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  if (!isDegreeLevel(required)) {
    // Unrecognised requirement string — nothing to compare against; treat
    // as not applicable rather than guessing.
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const requiredRank = RANK[required];
  const highest = normalized.education.highestDegree;

  if (highest && RANK[highest] >= requiredRank) {
    return {
      earned: WEIGHTS.education,
      maxPoints: WEIGHTS.education,
      evidence: [{ label: `Highest degree "${highest}" meets requirement ("${required}")`, points: WEIGHTS.education }],
    };
  }

  return {
    earned: 0,
    maxPoints: WEIGHTS.education,
    evidence: [
      {
        label: highest
          ? `Highest degree "${highest}" is below requirement ("${required}")`
          : `No education data recorded (requires at least "${required}")`,
        points: 0,
      },
    ],
  };
}
