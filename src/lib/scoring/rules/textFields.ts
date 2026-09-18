import type { Candidate } from "@/lib/apify";

/**
 * Free-text fields worth searching for a skill/title/exclusion term, beyond
 * the structured `skills` array. Shared by skills, titles, and exclusions
 * matching so a candidate whose source can't populate `skills` or
 * `currentTitle` structurally (e.g. GitHub) can still be matched against
 * whatever text it *does* have — its bio doubles as headline/summary.
 *
 * Field names are used as the "where" label in evidence lines, so they're
 * plain and user-facing ("headline", not "candidate.headline").
 */
export function textFields(candidate: Candidate): Record<string, string | null | undefined> {
  return {
    headline: candidate.headline,
    summary: candidate.summary,
    "current title": candidate.currentTitle,
    "past job titles": (candidate.experience ?? [])
      .map((e) => e?.title)
      .filter((t): t is string => typeof t === "string" && t.length > 0)
      .join(", "),
  };
}
