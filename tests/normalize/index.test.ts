import { describe, expect, it } from 'vitest'
import { normalizeProfile } from '@/lib/normalize'
import type { Candidate } from '@/lib/apify'

describe('normalizeProfile', () => {
  it('never throws for missing, null, or wrong-typed fields', () => {
    const badValues: unknown[] = [undefined, null, 42, 'oops', {}, []]
    const fields = ['location', 'education', 'experience', 'languages', 'industry', 'currentCompany']

    // One field at a time set to each bad value (with the rest at their bad-value default of
    // undefined) covers the "missing/null/wrong-typed" requirement without the combinatorial
    // blow-up of a full cartesian product across all six fields.
    for (const field of fields) {
      for (const bad of badValues) {
        const candidate = { [field]: bad } as unknown as Candidate
        expect(() => normalizeProfile(candidate)).not.toThrow()
      }
    }

    // Also check a candidate with every field simultaneously set to the same bad value.
    for (const bad of badValues) {
      const candidate = Object.fromEntries(fields.map((f) => [f, bad])) as unknown as Candidate
      expect(() => normalizeProfile(candidate)).not.toThrow()
    }
  })

  it('never throws for an entirely empty object cast to Candidate', () => {
    expect(() => normalizeProfile({} as Candidate)).not.toThrow()
    const result = normalizeProfile({} as Candidate)
    expect(result.industry).toBeNull()
    expect(result.totalYearsExperience).toBeNull()
  })

  it('prefers computed experience over the scraper-reported totalYearsExperience', () => {
    const now = new Date('2024-01-01T00:00:00Z')
    const candidate = {
      experience: [{ title: 'Eng', company: 'Acme', from: '2020-01-01', to: '2022-01-01' }],
      totalYearsExperience: 99,
    } as unknown as Candidate
    expect(normalizeProfile(candidate, now).totalYearsExperience).toBe(2)
  })

  it('falls back to the scraper value only when the computation yields null', () => {
    const candidate = {
      experience: [],
      totalYearsExperience: 5,
    } as unknown as Candidate
    expect(normalizeProfile(candidate).totalYearsExperience).toBe(5)
  })
})
