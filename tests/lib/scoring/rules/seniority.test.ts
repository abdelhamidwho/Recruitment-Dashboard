import { describe, expect, it } from 'vitest'
import { scoreSeniority } from '@/lib/scoring/rules/seniority'
import { normalizeProfile } from '@/lib/normalize'
import { WEIGHTS } from '@/lib/scoring/weights'
import type { Candidate } from '@/lib/apify'

function baseCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    externalId: 'x',
    fullName: 'Test',
    profileUrl: 'https://example.com/x',
    skills: [],
    experience: [],
    education: [],
    raw: {},
    ...overrides,
  }
}

describe('scoreSeniority — seniority label', () => {
  it('is not applicable when no seniority levels are requested', () => {
    const candidate = baseCandidate()
    const result = scoreSeniority(candidate, normalizeProfile(candidate), {})
    expect(result.maxPoints).toBe(0)
  })

  it('awards the label weight when title/headline mentions a requested level', () => {
    const candidate = baseCandidate({ currentTitle: 'Senior Backend Engineer' })
    const result = scoreSeniority(candidate, normalizeProfile(candidate), { seniority: ['Senior'] })
    expect(result.earned).toBe(WEIGHTS.seniorityLevel)
  })

  it('awards nothing when no requested level is mentioned', () => {
    const candidate = baseCandidate({ currentTitle: 'Backend Engineer' })
    const result = scoreSeniority(candidate, normalizeProfile(candidate), { seniority: ['Senior'] })
    expect(result.earned).toBe(0)
  })
})

describe('scoreSeniority — years of experience: absent vs zero', () => {
  it('does not penalize a candidate with no experience data at all (undefined)', () => {
    const candidate = baseCandidate({ totalYearsExperience: undefined, experience: [] })
    const result = scoreSeniority(candidate, normalizeProfile(candidate), { yearsMin: 3 })
    // Absent data must not enter the ratio at all: no points earned, no max
    // points charged against the candidate for it either.
    expect(result.earned).toBe(0)
    expect(result.maxPoints).toBe(0)
    expect(result.evidence.some((e) => e.label.includes('unknown'))).toBe(true)
    expect(result.evidence.some((e) => e.label.includes('below minimum'))).toBe(false)
  })

  it('still penalizes a real, reported zero (a genuine new graduate) below the minimum', () => {
    const candidate = baseCandidate({ totalYearsExperience: 0, experience: [] })
    const result = scoreSeniority(candidate, normalizeProfile(candidate), { yearsMin: 3 })
    expect(result.maxPoints).toBe(WEIGHTS.experienceYears)
    expect(result.earned).toBe(0)
    expect(result.evidence.some((e) => e.label.includes('below minimum'))).toBe(true)
  })

  it('still rewards a real zero when it is within the requested range', () => {
    const candidate = baseCandidate({ totalYearsExperience: 0, experience: [] })
    const result = scoreSeniority(candidate, normalizeProfile(candidate), { yearsMin: 0, yearsMax: 5 })
    expect(result.earned).toBe(WEIGHTS.experienceYears)
  })

  it('skips the years dimension entirely for a source that cannot supply experience (e.g. GitHub)', () => {
    const candidate = baseCandidate({ totalYearsExperience: undefined, experience: [] })
    const result = scoreSeniority(candidate, normalizeProfile(candidate), { yearsMin: 3 }, 'github')
    expect(result.maxPoints).toBe(0)
    expect(result.earned).toBe(0)
  })
})
