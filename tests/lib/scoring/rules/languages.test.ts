import { describe, expect, it } from 'vitest'
import { scoreLanguages } from '@/lib/scoring/rules/languages'
import { normalizeProfile } from '@/lib/normalize'
import { WEIGHTS } from '@/lib/scoring/weights'
import type { Candidate } from '@/lib/apify'

function candidateWithLanguages(languages: Candidate['languages']): Candidate {
  return {
    externalId: 'x',
    fullName: 'Test',
    profileUrl: 'https://example.com/x',
    skills: [],
    experience: [],
    education: [],
    languages,
    raw: {},
  }
}

describe('scoreLanguages', () => {
  it('is not applicable when no languages are requested', () => {
    const result = scoreLanguages(normalizeProfile(candidateWithLanguages([])), {})
    expect(result.maxPoints).toBe(0)
  })

  it('splits weight evenly and awards partial credit', () => {
    const candidate = candidateWithLanguages(['English'])
    const result = scoreLanguages(normalizeProfile(candidate), { languages: ['English', 'Arabic'] })
    expect(result.maxPoints).toBe(WEIGHTS.languages)
    expect(result.earned).toBeCloseTo(WEIGHTS.languages / 2)
  })

  it('never penalizes a candidate for languages a source cannot supply at all (GitHub)', () => {
    const candidate = candidateWithLanguages([])
    const result = scoreLanguages(normalizeProfile(candidate), { languages: ['English'] }, 'github')
    expect(result.maxPoints).toBe(0)
  })
})
