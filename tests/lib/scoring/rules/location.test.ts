import { describe, expect, it } from 'vitest'
import { scoreLocation } from '@/lib/scoring/rules/location'
import { normalizeProfile } from '@/lib/normalize'
import { WEIGHTS } from '@/lib/scoring/weights'
import type { Candidate } from '@/lib/apify'

function candidateAt(location: string | undefined): Candidate {
  return {
    externalId: 'x',
    fullName: 'Test',
    profileUrl: 'https://example.com/x',
    location,
    skills: [],
    experience: [],
    education: [],
    raw: {},
  }
}

describe('scoreLocation', () => {
  it('is not applicable when no location is requested', () => {
    const result = scoreLocation(normalizeProfile(candidateAt('Cairo, Egypt')), {})
    expect(result.maxPoints).toBe(0)
  })

  it('matches on city', () => {
    const result = scoreLocation(normalizeProfile(candidateAt('Cairo, Egypt')), { location: ['Cairo'] })
    expect(result.earned).toBe(WEIGHTS.location)
  })

  it('matches on country/region even when the city differs', () => {
    const result = scoreLocation(normalizeProfile(candidateAt('Dubai, United Arab Emirates')), {
      location: ['UAE'],
    })
    expect(result.earned).toBe(WEIGHTS.location)
  })

  it('awards nothing for a non-matching location', () => {
    const result = scoreLocation(normalizeProfile(candidateAt('Berlin, Germany')), { location: ['Cairo'] })
    expect(result.earned).toBe(0)
    expect(result.maxPoints).toBe(WEIGHTS.location)
  })

  it('awards nothing (not a crash) when location is entirely unknown', () => {
    const result = scoreLocation(normalizeProfile(candidateAt(undefined)), { location: ['Cairo'] })
    expect(result.earned).toBe(0)
  })

  it('matches when a single requested entry is itself a comma-separated place ("Cairo, Egypt" as one chip)', () => {
    // Real search data stores this both ways: ["Cairo", "Egypt"] as two
    // entries, or ["Cairo, Egypt"] as one. Both must match a candidate
    // whose normalized city is "Cairo".
    const result = scoreLocation(normalizeProfile(candidateAt('Cairo, Egypt')), { location: ['Cairo, Egypt'] })
    expect(result.earned).toBe(WEIGHTS.location)
  })
})
