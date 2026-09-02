import { normalizeEducation } from '../src/lib/normalize/education'
import { totalYearsOfExperience } from '../src/lib/normalize/experience'
import { normalizeIndustry } from '../src/lib/normalize/industry'
import { normalizeLanguages } from '../src/lib/normalize/languages'
import { normalizeLocation } from '../src/lib/normalize/location'

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export interface PersonInput {
  id: string
  fullName: string
  raw: string
  locationRaw: string | null
  education: string
  languages: string
  experience: string
  currentCompany: string | null
}

export interface NormalizationUpdate {
  city: string | null
  country: string | null
  region: string | null
  highestDegree: string | null
  fieldsOfStudy: string
  languages: string
  industry: string | null
  totalYearsExperience: number | null
}

/**
 * Pure per-person computation, kept separate from the database loop (in
 * prisma/backfill-normalize.ts) so the per-row failure isolation in runBackfill below can be
 * unit-tested without a real database, and so a throw from here (malformed raw JSON, or a
 * future change to one of the normalize/* modules) is caught per-person rather than aborting
 * the whole run.
 *
 * NOTE: `raw.industry` here and `candidate.industry` in normalizeProfile
 * (src/lib/normalize/index.ts) only agree because the live scrape path stores the full,
 * unmodified raw payload in Person.raw. If that ever changes to a trimmed/projected blob, the
 * two paths diverge and a person's derived industry would depend on which code path last
 * touched them.
 *
 * totalYearsExperience mirrors normalizeProfile's own fallback ordering: prefer the value
 * computed from the structured experience entries (which merges overlapping roles), and only
 * fall back to the scraper's own reported figure (raw.totalYearsExperience) when the
 * computation yields null. Falling back to the *already-stored* column instead would
 * perpetuate exactly the stale/wrong values this backfill exists to correct.
 */
export function computeNormalizationUpdate(person: PersonInput): NormalizationUpdate {
  const raw = parseJson<Record<string, unknown>>(person.raw, {})
  const location = normalizeLocation(person.locationRaw)
  const education = normalizeEducation(parseJson(person.education, []))
  const languages = normalizeLanguages(parseJson(person.languages, []))
  const years = totalYearsOfExperience(parseJson(person.experience, []))
  const industry = normalizeIndustry(raw.industry, person.currentCompany)
  const fallbackYears = typeof raw.totalYearsExperience === 'number' ? raw.totalYearsExperience : null

  return {
    city: location.city,
    country: location.country,
    region: location.region,
    highestDegree: education.highestDegree,
    fieldsOfStudy: JSON.stringify(education.fieldsOfStudy),
    languages: JSON.stringify(languages),
    industry,
    totalYearsExperience: years ?? fallbackYears,
  }
}

export interface BackfillClient {
  person: {
    findMany(): Promise<PersonInput[]>
    update(args: { where: { id: string }; data: NormalizationUpdate }): Promise<unknown>
  }
}

export interface BackfillFailure {
  id: string
  fullName: string
  error: string
}

export interface BackfillResult {
  examined: number
  updated: number
  failed: number
  failures: BackfillFailure[]
}

/**
 * Normalises every person via the injected client.
 *
 * Isolation is per-row: if computeNormalizationUpdate or client.person.update throws for one
 * person, that failure is recorded (with the person's id/name and the error message) and the
 * loop continues with the remaining rows, rather than one bad row aborting the whole backfill.
 * Only when the whole table read (findMany) or something outside the loop throws does the run
 * abort entirely — that is intentional, not this function's job to guard against.
 *
 * Note: this loads the whole table with findMany() and updates row by row. That is fine at
 * HR-sourcing volumes (low hundreds/thousands of people) but is the first thing to change
 * (e.g. batching, or a single SQL UPDATE where possible) if the table ever gets large.
 */
export async function runBackfill(client: BackfillClient): Promise<BackfillResult> {
  const people = await client.person.findMany()
  let updated = 0
  const failures: BackfillFailure[] = []

  for (const person of people) {
    try {
      const data = computeNormalizationUpdate(person)
      await client.person.update({ where: { id: person.id }, data })
      updated += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push({ id: person.id, fullName: person.fullName, error: message })
      console.error(`failed to normalise person ${person.id} (${person.fullName}): ${message}`)
    }
  }

  return { examined: people.length, updated, failed: failures.length, failures }
}
