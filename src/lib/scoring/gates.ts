import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";
import { matchesTerm } from "./matching";
import { findExclusionHits } from "./rules/exclusions";
import { textFields } from "./rules/textFields";
import { unsupportedFieldsFor } from "./sourceSupport";
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
 *
 * ## Must-have skills vs. a source that cannot supply `skills`
 *
 * A must-have skill can only be a *hard* gate when "not found" is reliable
 * evidence of absence. That's true when the source populates a real
 * structured `skills` array (e.g. the mock LinkedIn source): an empty
 * array genuinely means "this person didn't list it". It stops being true
 * for a source that declares `skills` in `unsupportedFields` (GitHub):
 * `candidate.skills` is `[]` for *every* GitHub candidate regardless of
 * what they actually know, so "not found in skills" carries no
 * information, and "not found in bio/headline text either" is just as
 * unreliable — a bio is free prose, and most people don't recite their
 * whole stack in two sentences.
 *
 * So for a source that can't supply `skills`, this gate does not fire on
 * that dimension at all — neither a hit nor a miss removes the candidate.
 * A match found in the candidate's text fields is still surfaced, but only
 * as a soft-scoring signal (see `scoreNiceToHaveSkills` in
 * `rules/skills.ts`, which folds unverifiable must-haves in alongside
 * nice-to-haves) so it can still separate a candidate whose bio mentions
 * the skill from one that never does, without ever hard-excluding either.
 * This is deliberately *not* symmetric with the excluded-keyword gate
 * below: that gate only ever fires on a positive match (a keyword actually
 * found in real text), never on an absence, so an unsupported field can't
 * make it misfire — there is nothing to make unreliable.
 */
export function applyGates(
  candidate: Candidate,
  filters: Partial<SearchFilters>,
  sourceId?: string | null,
): GateCheck {
  const reasons: string[] = [];

  const unsupported = unsupportedFieldsFor(sourceId);
  const skillsUnverifiable = unsupported.has("skills");

  const mustHave = (filters.mustHave ?? []).map((s) => s?.trim()).filter((s): s is string => Boolean(s));
  const fields = textFields(candidate);
  if (!skillsUnverifiable) {
    for (const skill of mustHave) {
      const result = matchesTerm(skill, { skills: candidate.skills, textFields: fields });
      if (!result.matched) {
        reasons.push(`Missing must-have skill "${skill}"`);
      }
    }
  }

  reasons.push(...findExclusionHits(candidate, filters));

  return { passed: reasons.length === 0, reasons };
}
