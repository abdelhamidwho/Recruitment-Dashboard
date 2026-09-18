import { describe, expect, it } from 'vitest'
import { scoreTitles } from '@/lib/scoring/rules/titles'
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

describe('scoreTitles', () => {
  it('is not applicable when no titles are requested', () => {
    const result = scoreTitles(baseCandidate(), {})
    expect(result.maxPoints).toBe(0)
  })

  it('awards full weight for any one matching title (OR semantics)', () => {
    const candidate = baseCandidate({ currentTitle: 'Data Engineer' })
    const result = scoreTitles(candidate, { titles: ['Data Analyst', 'Data Engineer', 'ML Engineer'] })
    expect(result.earned).toBe(WEIGHTS.titles)
  })

  it('matches via headline when currentTitle is unavailable (GitHub-style candidate)', () => {
    const candidate = baseCandidate({ headline: 'Senior Data Engineer & Architect' })
    const result = scoreTitles(candidate, { titles: ['Data Engineer'] })
    expect(result.earned).toBe(WEIGHTS.titles)
  })

  it('awards nothing when no requested title matches', () => {
    const candidate = baseCandidate({ currentTitle: 'Marketing Manager' })
    const result = scoreTitles(candidate, { titles: ['Data Engineer'] })
    expect(result.earned).toBe(0)
    expect(result.maxPoints).toBe(WEIGHTS.titles)
  })
})
