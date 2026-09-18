import { describe, expect, it } from 'vitest'
import { scoreEducation } from '@/lib/scoring/rules/education'
import { normalizeProfile } from '@/lib/normalize'
import { WEIGHTS } from '@/lib/scoring/weights'
import type { Candidate } from '@/lib/apify'

function candidateWithEducation(entries: Candidate['education']): Candidate {
  return {
    externalId: 'x',
    fullName: 'Test',
    profileUrl: 'https://example.com/x',
    skills: [],
    experience: [],
    education: entries,
    raw: {},
  }
}

describe('scoreEducation', () => {
  it('is not applicable when no education requirement is set', () => {
    const candidate = candidateWithEducation([])
    const result = scoreEducation(normalizeProfile(candidate), {})
    expect(result.maxPoints).toBe(0)
  })

  it('awards full weight when the highest degree meets the requirement', () => {
    const candidate = candidateWithEducation([{ school: 'Cairo University', degree: "Master's" }])
    const result = scoreEducation(normalizeProfile(candidate), { education: 'Bachelor' })
    expect(result.earned).toBe(WEIGHTS.education)
  })

  it('awards nothing when the highest degree is below the requirement', () => {
    const candidate = candidateWithEducation([{ school: 'Cairo University', degree: 'Diploma' }])
    const result = scoreEducation(normalizeProfile(candidate), { education: 'Bachelor' })
    expect(result.earned).toBe(0)
    expect(result.maxPoints).toBe(WEIGHTS.education)
  })

  it('never penalizes a candidate for education a source cannot supply at all (GitHub)', () => {
    const candidate = candidateWithEducation([])
    const result = scoreEducation(normalizeProfile(candidate), { education: 'Bachelor' }, 'github')
    expect(result.maxPoints).toBe(0)
    expect(result.earned).toBe(0)
  })

  it('does score a real absence of education data for a source that can supply it', () => {
    const candidate = candidateWithEducation([])
    const result = scoreEducation(normalizeProfile(candidate), { education: 'Bachelor' })
    expect(result.maxPoints).toBe(WEIGHTS.education)
    expect(result.earned).toBe(0)
  })
})
