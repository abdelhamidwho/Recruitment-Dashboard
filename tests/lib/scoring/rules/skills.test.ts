import { describe, expect, it } from 'vitest'
import { scoreNiceToHaveSkills } from '@/lib/scoring/rules/skills'
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

describe('scoreNiceToHaveSkills', () => {
  it('is not applicable when no nice-to-have skills are requested', () => {
    const result = scoreNiceToHaveSkills(baseCandidate(), {})
    expect(result.maxPoints).toBe(0)
    expect(result.earned).toBe(0)
  })

  it('splits the weight evenly and awards partial credit', () => {
    const candidate = baseCandidate({ skills: ['AWS'] })
    const result = scoreNiceToHaveSkills(candidate, { niceToHave: ['AWS', 'Spark', 'dbt'] })
    expect(result.maxPoints).toBe(WEIGHTS.niceToHaveSkills)
    expect(result.earned).toBeCloseTo(WEIGHTS.niceToHaveSkills / 3)
  })

  it('awards full credit when every nice-to-have matches', () => {
    const candidate = baseCandidate({ skills: ['AWS', 'Spark'] })
    const result = scoreNiceToHaveSkills(candidate, { niceToHave: ['AWS', 'Spark'] })
    expect(result.earned).toBe(WEIGHTS.niceToHaveSkills)
  })

  it('matches via headline text when skills array is empty (GitHub-style candidate)', () => {
    const candidate = baseCandidate({ headline: 'Building data pipelines with dbt and Airflow' })
    const result = scoreNiceToHaveSkills(candidate, { niceToHave: ['dbt'] })
    expect(result.earned).toBe(WEIGHTS.niceToHaveSkills)
  })

  it('does not let "Java" satisfy a nice-to-have "JavaScript"', () => {
    const candidate = baseCandidate({ skills: ['Java'] })
    const result = scoreNiceToHaveSkills(candidate, { niceToHave: ['JavaScript'] })
    expect(result.earned).toBe(0)
  })
})
