import { describe, expect, it } from 'vitest'
import { scoreIndustry } from '@/lib/scoring/rules/industry'
import { normalizeProfile } from '@/lib/normalize'
import { WEIGHTS } from '@/lib/scoring/weights'
import type { Candidate } from '@/lib/apify'

function candidateInIndustry(industry: string | undefined): Candidate {
  return {
    externalId: 'x',
    fullName: 'Test',
    profileUrl: 'https://example.com/x',
    industry,
    skills: [],
    experience: [],
    education: [],
    raw: {},
  }
}

describe('scoreIndustry', () => {
  it('is not applicable when no industry is requested', () => {
    const result = scoreIndustry(normalizeProfile(candidateInIndustry('Fintech')), {})
    expect(result.maxPoints).toBe(0)
  })

  it('never penalizes a candidate for industry a source cannot supply at all (GitHub)', () => {
    const candidate = candidateInIndustry(undefined)
    const result = scoreIndustry(normalizeProfile(candidate), { industry: ['Fintech'] }, 'github')
    expect(result.maxPoints).toBe(0)
  })

  it('matches a requested industry against the candidate normalized industry', () => {
    // 'fintech' normalizes to the canonical 'Financial Services' bucket.
    const candidate = candidateInIndustry('fintech')
    const result = scoreIndustry(normalizeProfile(candidate), { industry: ['Financial Services'] })
    expect(result.earned).toBe(WEIGHTS.industry)
  })
})
