import { prisma } from "@/lib/prisma";
import { normalizeProfile } from "@/lib/normalize";
import { scoreCandidate, GATED_SCORE_SENTINEL } from "@/lib/scoring";
import type { Candidate } from "@/lib/apify";
import type { SearchFilters } from "@/lib/buildBooleanQuery";

/**
 * Upserts one scraped/fetched profile onto its permanent Person row, keyed on
 * profileUrl. Shared by every source (async Apify polling route, synchronous
 * sources handled inline in POST /api/search) so dedup and normalisation
 * behave identically no matter which source produced the candidate.
 *
 * `source` (e.g. "github", "apify") is recorded on the Person row so a mixed
 * pool of candidates is interpretable later. It is NOT part of the dedup key
 * (profileUrl still is) — a profile encountered again from the same URL is
 * the same person even if, hypothetically, a different source reported it.
 */
export async function upsertPerson(candidate: Candidate, source?: string) {
  const normalized = normalizeProfile(candidate);

  const shared = {
    externalId: candidate.externalId,
    source,
    fullName: candidate.fullName,
    headline: candidate.headline,
    currentTitle: candidate.currentTitle,
    currentCompany: candidate.currentCompany,
    avatarUrl: candidate.avatarUrl,
    summary: candidate.summary,
    locationRaw: normalized.location.raw,
    city: normalized.location.city,
    country: normalized.location.country,
    region: normalized.location.region,
    industry: normalized.industry,
    highestDegree: normalized.education.highestDegree,
    fieldsOfStudy: JSON.stringify(normalized.education.fieldsOfStudy),
    totalYearsExperience: normalized.totalYearsExperience,
    skills: JSON.stringify(candidate.skills ?? []),
    experience: JSON.stringify(candidate.experience ?? []),
    education: JSON.stringify(candidate.education ?? []),
    languages: JSON.stringify(normalized.languages),
    certifications: JSON.stringify(candidate.certifications ?? []),
    raw: JSON.stringify(candidate.raw ?? {}),
    lastRefreshedAt: new Date(),
  };

  const existing = await prisma.person.findUnique({
    where: { profileUrl: candidate.profileUrl },
    select: { id: true },
  });

  const person = await prisma.person.upsert({
    where: { profileUrl: candidate.profileUrl },
    create: { profileUrl: candidate.profileUrl, ...shared },
    update: shared,
  });

  return { person, wasKnownBefore: existing !== null };
}

/**
 * Scores a candidate against filters and records/updates its SearchRunPerson
 * appearance for a given run. Kept alongside upsertPerson (rather than left
 * for each caller to reimplement) so "store a candidate against a run" is one
 * call for both the sync and async source paths.
 *
 * A candidate that fails a hard gate (missing must-have skill, or an
 * excluded-keyword hit — see `src/lib/scoring/gates.ts`) is still upserted
 * as a Person (so it's not re-fetched pointlessly next time) but is
 * recorded with `GATED_SCORE_SENTINEL` rather than a real 0-100 score, and
 * `scoreBreakdown` carries the gate reason(s) instead of scoring evidence.
 * Callers building a results list (e.g.
 * `src/app/api/search/[searchRunId]/route.ts`) must filter these out of the
 * ranked list and report the count separately — a gate is meant to be
 * visible, not a silent drop.
 */
export async function recordAppearance(
  searchRunId: string,
  candidate: Candidate,
  filters: Partial<SearchFilters>,
  source?: string,
) {
  const { person, wasKnownBefore } = await upsertPerson(candidate, source);
  const result = scoreCandidate(candidate, filters, source);
  const score = result.gated ? GATED_SCORE_SENTINEL : result.score;

  await prisma.searchRunPerson.upsert({
    where: { searchRunId_personId: { searchRunId, personId: person.id } },
    create: {
      searchRunId,
      personId: person.id,
      score,
      scoreBreakdown: JSON.stringify(result.breakdown),
      wasKnownBefore,
    },
    update: { score, scoreBreakdown: JSON.stringify(result.breakdown) },
  });

  return { person, wasKnownBefore, score, gated: result.gated };
}
