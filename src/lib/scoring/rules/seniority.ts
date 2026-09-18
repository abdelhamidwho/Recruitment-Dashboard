import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import type { NormalizedProfile } from "@/lib/normalize";
import { matchesTerm } from "../matching";
import { WEIGHTS } from "../weights";
import type { Evidence, RuleResult } from "../types";
import { textFields } from "./textFields";
import { allUnsupported, unsupportedFieldsFor } from "../sourceSupport";

/**
 * Career-stage scoring, split into two independent sub-parts so a search
 * that sets only one of them (e.g. a years range with no seniority label)
 * still gets a meaningful score out of the part it did set:
 *
 * - **Seniority label** (`filters.seniority`, e.g. "Senior", "Staff"):
 *   matched as a word against title/headline text, same as titles.ts.
 * - **Years of experience** (`filters.yearsMin`/`yearsMax`): compared
 *   against `normalized.totalYearsExperience`.
 *
 * The years sub-part preserves a fix that must not regress: an *absent*
 * experience figure (the source never reports employment history, e.g.
 * GitHub) is neutral — no bonus, no penalty — as opposed to a genuine
 * reported zero (a new graduate), which is real data and is scored
 * normally against the requested range. Conflating the two used to
 * penalize every GitHub candidate for data that source cannot supply.
 */
export function scoreSeniority(
  candidate: Candidate,
  normalized: NormalizedProfile,
  filters: Partial<SearchFilters>,
  sourceId?: string | null,
): RuleResult {
  const unsupported = unsupportedFieldsFor(sourceId);
  const evidence: Evidence[] = [];
  let earned = 0;
  let maxPoints = 0;

  // --- Seniority label ---------------------------------------------------
  const levels = (filters.seniority ?? []).map((s) => s?.trim()).filter((s): s is string => Boolean(s));
  if (levels.length > 0) {
    maxPoints += WEIGHTS.seniorityLevel;
    const fields = textFields(candidate);
    const matched = levels.find((level) => matchesTerm(level, { textFields: fields }).matched);
    if (matched) {
      earned += WEIGHTS.seniorityLevel;
      evidence.push({ label: `Title/headline indicates "${matched}" seniority`, points: WEIGHTS.seniorityLevel });
    } else {
      evidence.push({
        label: `Title/headline does not indicate any requested seniority (${levels.join(", ")})`,
        points: 0,
      });
    }
  }

  // --- Years of experience ------------------------------------------------
  const yearsMin = filters.yearsMin;
  const yearsMax = filters.yearsMax;
  const hasYearsFilter = typeof yearsMin === "number" || typeof yearsMax === "number";
  const yearsSourced = !allUnsupported(unsupported, ["totalYearsExperience", "experience"]);

  if (hasYearsFilter && yearsSourced) {
    const yoe = normalized.totalYearsExperience;
    maxPoints += WEIGHTS.experienceYears;

    if (yoe === null) {
      // Neutral: contributes to neither earned nor the "miss" case — but it
      // must still count toward maxPoints being asked, so the ratio isn't
      // silently inflated. To keep that honest, absent data removes this
      // sub-part from consideration entirely (see below) instead of
      // pretending it was satisfied.
      maxPoints -= WEIGHTS.experienceYears;
      evidence.push({ label: "Experience unknown (source does not report years of experience)", points: 0 });
    } else if (typeof yearsMin === "number" && yoe < yearsMin) {
      evidence.push({ label: `Experience (${yoe}y) below minimum (${yearsMin}y)`, points: 0 });
    } else if (typeof yearsMax === "number" && yoe > yearsMax) {
      evidence.push({ label: `Experience (${yoe}y) above maximum (${yearsMax}y)`, points: 0 });
    } else {
      earned += WEIGHTS.experienceYears;
      evidence.push({ label: `Experience (${yoe}y) within requested range`, points: WEIGHTS.experienceYears });
    }
  }

  return { earned, maxPoints, evidence };
}
