import type { Candidate } from '@/lib/apify'
import { normalizeEducation, type NormalizedEducation } from './education'
import { totalYearsOfExperience } from './experience'
import { normalizeIndustry } from './industry'
import { normalizeLanguages, type NormalizedLanguage } from './languages'
import { normalizeLocation, type NormalizedLocation } from './location'

export * from './education'
export * from './experience'
export * from './industry'
export * from './languages'
export * from './location'
export * from './regions'

export interface NormalizedProfile {
  location: NormalizedLocation
  education: NormalizedEducation
  languages: NormalizedLanguage[]
  industry: string | null
  totalYearsExperience: number | null
}

/**
 * Composes the five sibling normalisation modules into one profile-shaped result.
 *
 * Contract:
 * - Never throws. `candidate` is treated as untrusted: every field it reads
 *   (`location`, `education`, `experience`, `languages`, `industry`, `currentCompany`) may be
 *   missing, `null`, or the wrong type, because it may originate from raw scraper output or
 *   from `mapToCandidate`'s `any`-typed input. Each sibling module is itself defensive against
 *   this, so this function does not add its own guards beyond passing the fields straight
 *   through.
 * - `totalYearsExperience` prefers the value computed from `candidate.experience` (which
 *   merges overlapping roles) over the scraper-reported `candidate.totalYearsExperience`,
 *   and only falls back to the scraper's value when the computation yields `null` (no usable
 *   experience data at all). This ordering is deliberate: the scraper's field is frequently
 *   absent, and treating "absent" as `0` is the exact accuracy bug this normalisation layer
 *   exists to fix.
 *
 * @param now - Clock passed through to `totalYearsOfExperience` for ongoing-role
 *   measurement. Defaults to `new Date()`; callers that need determinism (tests) should pass
 *   a fixed value.
 */
export function normalizeProfile(candidate: Candidate, now: Date = new Date()): NormalizedProfile {
  candidate = candidate ?? ({} as Candidate)
  return {
    location: normalizeLocation(candidate?.location),
    education: normalizeEducation(candidate?.education),
    languages: normalizeLanguages(candidate?.languages),
    industry: normalizeIndustry(candidate?.industry, candidate?.currentCompany),
    totalYearsExperience:
      totalYearsOfExperience(candidate?.experience, now) ?? candidate?.totalYearsExperience ?? null,
  }
}
