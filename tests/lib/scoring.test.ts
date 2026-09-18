import { describe, expect, it } from 'vitest'
import { scoreCandidate } from '@/lib/scoring'
import type { Candidate } from '@/lib/apify'

// NOTE ON THIS FILE'S HISTORY: the previous version of this file tested the
// old `src/lib/scoring.ts` — a single-function scorer built around a fixed
// base of 50 plus/minus small deltas, clamped to 0-100. That whole model is
// gone: it clustered nearly every candidate at the same score (see the
// rewrite's verification notes), which is the defect this rewrite fixes.
// Every assertion tied to the old base-50 arithmetic (e.g. "score is
// exactly 55") has been replaced with assertions about the *new* model:
// gates removing non-matches outright, and soft scoring producing a real
// spread rather than a fixed base plus a handful of points. The one
// behaviour explicitly required to survive — unknown experience being
// neutral rather than a penalty — is still covered below, adapted to the
// new return shape.

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

describe('scoreCandidate — gates remove non-matches instead of docking points', () => {
  it('gates out a candidate missing a must-have skill entirely', () => {
    const candidate = baseCandidate({ skills: ['Python'] })
    const result = scoreCandidate(candidate, { mustHave: ['Python', 'Airflow'] })
    expect(result.gated).toBe(true)
    expect(result.breakdown.some((line) => line.includes('Missing must-have skill "Airflow"'))).toBe(true)
  })

  it('gates out a candidate hit by an excluded keyword in the title', () => {
    const candidate = baseCandidate({ currentTitle: 'Software Engineering Intern' })
    const result = scoreCandidate(candidate, { exclude: ['Intern'] })
    expect(result.gated).toBe(true)
  })

  it('does not gate a candidate that satisfies every must-have and hits no exclusion', () => {
    const candidate = baseCandidate({ skills: ['Python', 'SQL'], currentTitle: 'Data Engineer' })
    const result = scoreCandidate(candidate, { mustHave: ['Python', 'SQL'], exclude: ['Intern'] })
    expect(result.gated).toBe(false)
  })
})

describe('scoreCandidate — years of experience null vs zero (preserved fix)', () => {
  it('does not penalize a candidate with no experience data at all (undefined)', () => {
    const candidate = baseCandidate({ totalYearsExperience: undefined })
    const result = scoreCandidate(candidate, { yearsMin: 3 })
    expect(result.gated).toBe(false)
    expect(result.breakdown.some((line) => line.includes('Experience unknown'))).toBe(true)
    expect(result.breakdown.some((line) => line.includes('below minimum'))).toBe(false)
  })

  it('still penalizes a real, reported zero (a genuine new graduate) below the minimum', () => {
    const candidate = baseCandidate({ totalYearsExperience: 0 })
    const result = scoreCandidate(candidate, { yearsMin: 3 })
    expect(result.breakdown.some((line) => line.includes('below minimum (3y)'))).toBe(true)
    expect(result.score).toBe(0) // the only applicable dimension (years) was missed entirely
  })

  it('still rewards a real zero when it falls within the requested range', () => {
    const candidate = baseCandidate({ totalYearsExperience: 0 })
    const result = scoreCandidate(candidate, { yearsMin: 0, yearsMax: 5 })
    expect(result.score).toBe(100) // the only applicable dimension (years) was fully met
  })

  it('never lets an unsupported-by-source field (GitHub + experience) affect the score', () => {
    const candidate = baseCandidate({ totalYearsExperience: undefined, skills: ['Python'], currentTitle: 'Backend Engineer' })
    const filters = { yearsMin: 3, titles: ['Backend Engineer'] }
    const withGithub = scoreCandidate(candidate, filters, 'github')
    // Same filters, same (empty) experience data, but a source that has no
    // special-cased gap for it — the years dimension IS asked for and IS
    // evaluated (yielding a neutral "unknown" line), yet the ratio comes
    // out identical to GitHub's outright skip, because either way an
    // absent figure contributes to neither the earned points nor the
    // applicable max.
    const withGenericSource = scoreCandidate(candidate, filters)
    expect(withGithub.score).toBe(withGenericSource.score)
    expect(withGithub.gated).toBe(false)
  })
})

describe('scoreCandidate — real spread on a realistic candidate pool', () => {
  // Mirrors the shape of the real "Data Engineer" GitHub search run that
  // motivated this rewrite: mustHave ["SQL","Python","Airflow","Snowflake"],
  // niceToHave ["dbt","AWS","Spark"], titles, seniority "Senior", years 4-10,
  // and candidates whose only real signal is a GitHub bio (headline).
  const filters = {
    titles: ['Data Engineer'],
    mustHave: ['Python'],
    niceToHave: ['dbt', 'AWS', 'Spark', 'Snowflake', 'Airflow'],
    seniority: ['Senior'],
  }

  const pool: Candidate[] = [
    baseCandidate({
      fullName: 'Strong match',
      headline: 'Senior Data Engineer · Airflow · dbt · Snowflake · AWS · Python',
      skills: ['Python'],
    }),
    baseCandidate({
      fullName: 'Partial match',
      headline: 'Data Engineer working with dbt',
      skills: ['Python'],
    }),
    baseCandidate({
      fullName: 'Bare minimum match',
      headline: 'Backend generalist',
      skills: ['Python'],
    }),
  ]

  it('produces genuinely different scores instead of clustering on one value', () => {
    const scores = pool.map((c) => scoreCandidate(c, filters).score)
    const distinct = new Set(scores)
    expect(distinct.size).toBeGreaterThan(1)
    // Strictly descending in the order listed above, matching how much
    // evidence each headline actually contains.
    expect(scores[0]).toBeGreaterThan(scores[1])
    expect(scores[1]).toBeGreaterThan(scores[2])
  })
})

describe('scoreCandidate — a source declaring a dimension unsupported cannot be gated out on it', () => {
  // Regression test for the reported bug: a real 30-candidate GitHub run
  // (mustHave ["SQL","Python","Airflow","Snowflake"]) gated out 30 of 30,
  // because github.ts declares "skills" unsupported (candidate.skills is
  // always []) and gates.ts checked mustHave skills without consulting
  // that declaration.
  const filters = { mustHave: ['SQL', 'Python', 'Airflow', 'Snowflake'] }

  it('never gates a GitHub candidate on must-have skills, matching bio or not', () => {
    const noEvidence = baseCandidate({ skills: [], headline: 'Backend generalist' })
    const partialEvidence = baseCandidate({ skills: [], headline: 'Python and SQL engineer' })
    const fullEvidence = baseCandidate({
      skills: [],
      headline: 'SQL, Python, Airflow, Snowflake — data platform lead',
    })

    for (const candidate of [noEvidence, partialEvidence, fullEvidence]) {
      const result = scoreCandidate(candidate, filters, 'github')
      expect(result.gated).toBe(false)
    }
  })

  it('still separates candidates by how much bio evidence they carry, rather than flattening to one score', () => {
    const noEvidence = baseCandidate({ skills: [], headline: 'Backend generalist' })
    const fullEvidence = baseCandidate({
      skills: [],
      headline: 'SQL, Python, Airflow, Snowflake — data platform lead',
    })
    const noEvidenceScore = scoreCandidate(noEvidence, filters, 'github').score
    const fullEvidenceScore = scoreCandidate(fullEvidence, filters, 'github').score
    expect(fullEvidenceScore).toBeGreaterThan(noEvidenceScore)
  })

  it('a source that CAN supply skills (mock LinkedIn/apify) still gates normally on the same filters', () => {
    const missingAirflow = baseCandidate({ skills: ['SQL', 'Python', 'Snowflake'] })
    const result = scoreCandidate(missingAirflow, filters, 'apify')
    expect(result.gated).toBe(true)
    expect(result.breakdown.some((line) => line.includes('Missing must-have skill "Airflow"'))).toBe(true)
  })
})
