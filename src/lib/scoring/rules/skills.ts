import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { matchesTerm } from "../matching";
import { unsupportedFieldsFor } from "../sourceSupport";
import { WEIGHTS } from "../weights";
import type { RuleResult } from "../types";
import { textFields } from "./textFields";

/**
 * Nice-to-have skills, plus (for a source that can't supply a structured
 * `skills` list, e.g. GitHub) must-have skills that `gates.ts` declined to
 * hard-gate on for exactly that reason — see the long comment on
 * `applyGates` in `../gates.ts` for why "not found" isn't reliable enough
 * evidence to exclude such a candidate. Those unverifiable must-haves still
 * deserve to influence ranking: a GitHub candidate whose bio mentions every
 * requested skill should outrank one whose bio mentions none, even though
 * neither was excluded. They're folded into this same pool (not scored
 * separately) so the fix doesn't invent a second weight bucket — they share
 * `WEIGHTS.niceToHaveSkills`, split evenly across the combined list.
 *
 * For a source that *can* supply `skills` structurally, must-have skills
 * stay a pure hard gate exactly as before: every surviving candidate
 * already has all of them, so scoring them again here would just add a
 * constant to every candidate and contribute nothing to the ranking.
 *
 * Matching searches `skills`, `headline`, `summary`, `currentTitle`, and
 * past job titles (see `textFields`) — not just the structured `skills`
 * array — because a source like GitHub has no skills list at all but often
 * mentions technologies in its bio.
 */
export function scoreNiceToHaveSkills(
  candidate: Candidate,
  filters: Partial<SearchFilters>,
  sourceId?: string | null,
): RuleResult {
  const niceToHave = (filters.niceToHave ?? []).map((s) => s?.trim()).filter((s): s is string => Boolean(s));

  const skillsUnverifiable = unsupportedFieldsFor(sourceId).has("skills") || candidate.skillsComplete === false;
  const unverifiableMustHave = skillsUnverifiable
    ? (filters.mustHave ?? []).map((s) => s?.trim()).filter((s): s is string => Boolean(s))
    : [];

  const scored = [
    ...niceToHave.map((skill) => ({ skill, kind: "nice-to-have" as const })),
    ...unverifiableMustHave.map((skill) => ({ skill, kind: "must-have" as const })),
  ];

  if (scored.length === 0) {
    return { earned: 0, maxPoints: 0, evidence: [] };
  }

  const perSkill = WEIGHTS.niceToHaveSkills / scored.length;
  const evidence = scored.map(({ skill, kind }) => {
    const result = matchesTerm(skill, { skills: candidate.skills, textFields: textFields(candidate) });
    if (result.matched) {
      return { label: `Has ${kind} skill "${skill}" (in ${result.where.join(", ")})`, points: perSkill };
    }
    if (kind === "must-have") {
      return {
        label: `Cannot verify must-have skill "${skill}" — source has no skills list, not found in available text`,
        points: 0,
      };
    }
    return { label: `Missing nice-to-have skill "${skill}"`, points: 0 };
  });

  const earned = evidence.reduce((sum, e) => sum + e.points, 0);
  return { earned, maxPoints: WEIGHTS.niceToHaveSkills, evidence };
}
