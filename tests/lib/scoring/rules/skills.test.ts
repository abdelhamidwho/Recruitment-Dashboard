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

  it('ignores sourceId (no must-have folding) when the source is not passed or supports skills', () => {
    const candidate = baseCandidate({ skills: [] })
    const result = scoreNiceToHaveSkills(candidate, { mustHave: ['Python'] })
    expect(result.maxPoints).toBe(0) // must-have with no sourceId isn't folded in; stays a pure gate concern
    const resultApify = scoreNiceToHaveSkills(candidate, { mustHave: ['Python'] }, 'apify')
    expect(resultApify.maxPoints).toBe(0)
  })

  it('folds must-have skills into soft scoring for a source that cannot supply a skills list (GitHub)', () => {
    // gates.ts no longer hard-gates a must-have skill for such a source
    // (see gates.test.ts); this is what lets ranking still separate a
    // candidate whose bio evidences the requirement from one that doesn't.
    const strong = baseCandidate({ skills: [], headline: 'Python, Airflow, Snowflake, SQL all day' })
    const weak = baseCandidate({ skills: [], headline: 'Backend generalist' })
    const filters = { mustHave: ['SQL', 'Python', 'Airflow', 'Snowflake'] }
    const strongResult = scoreNiceToHaveSkills(strong, filters, 'github')
    const weakResult = scoreNiceToHaveSkills(weak, filters, 'github')
    expect(strongResult.maxPoints).toBe(WEIGHTS.niceToHaveSkills)
    expect(strongResult.earned).toBe(WEIGHTS.niceToHaveSkills)
    expect(weakResult.earned).toBe(0)
    expect(strongResult.earned).toBeGreaterThan(weakResult.earned)
  })

  it('combines nice-to-have and unverifiable must-have skills into one evenly split pool', () => {
    const candidate = baseCandidate({ skills: [], headline: 'dbt and Python' })
    const result = scoreNiceToHaveSkills(candidate, { niceToHave: ['dbt'], mustHave: ['Python'] }, 'github')
    expect(result.maxPoints).toBe(WEIGHTS.niceToHaveSkills)
    expect(result.earned).toBe(WEIGHTS.niceToHaveSkills) // both terms found
  })
})
