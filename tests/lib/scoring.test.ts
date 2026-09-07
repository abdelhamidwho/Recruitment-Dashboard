import { describe, expect, it } from 'vitest'
import { scoreCandidate } from '@/lib/scoring'
import type { Candidate } from '@/lib/apify'

function baseCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    externalId: 'x',
    fullName: 'Test Candidate',
    profileUrl: 'https://example.com/x',
    skills: [],
    experience: [],
    education: [],
    raw: {},
    ...overrides,
  }
}

describe('scoreCandidate — years of experience null vs zero', () => {
  it('does not penalize a candidate with no experience data at all (undefined)', () => {
    const candidate = baseCandidate({ totalYearsExperience: undefined })
    const { score, breakdown } = scoreCandidate(candidate, { yearsMin: 3 })
    // Base score is 50; an unknown figure must contribute neither bonus nor penalty.
    expect(score).toBe(50)
    expect(breakdown).toContain('+0: Experience unknown (source does not report years of experience)')
    expect(breakdown.some((line) => line.includes('below minimum'))).toBe(false)
  })

  it('still penalizes a real, reported zero (a genuine new graduate) below the minimum', () => {
    const candidate = baseCandidate({ totalYearsExperience: 0 })
    const { score, breakdown } = scoreCandidate(candidate, { yearsMin: 3 })
    expect(score).toBe(40) // 50 - 10
    expect(breakdown).toContain('-10: Experience (0y) below minimum (3y)')
  })

  it('still rewards a real zero when there is no minimum requirement', () => {
    const candidate = baseCandidate({ totalYearsExperience: 0 })
    const { score, breakdown } = scoreCandidate(candidate, {})
    expect(score).toBe(55) // 50 + 5, within range (no minimum set)
    expect(breakdown).toContain('+5: Experience (0y) within range')
  })

  it('leaves must-have/nice-to-have/title scoring unaffected by the unknown-experience branch', () => {
    const candidate = baseCandidate({
      totalYearsExperience: undefined,
      skills: ['Python'],
      currentTitle: 'Backend Engineer',
    })
    const { score } = scoreCandidate(candidate, {
      mustHave: ['Python'],
      titles: ['Backend Engineer'],
    })
    // 50 base + 5 (must-have) + 5 (title) + 0 (unknown experience, no yearsMin/Max set)
    expect(score).toBe(60)
  })
})
