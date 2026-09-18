import { describe, expect, it } from 'vitest'
import { applyGates } from '@/lib/scoring/gates'
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

describe('applyGates — must-have skills', () => {
  it('excludes a candidate missing a required must-have skill', () => {
    const candidate = baseCandidate({ skills: ['Python'] })
    const result = applyGates(candidate, { mustHave: ['Python', 'Airflow'] })
    expect(result.passed).toBe(false)
    expect(result.reasons).toContain('Missing must-have skill "Airflow"')
  })

  it('passes a candidate with every must-have, found anywhere in skills/headline/summary/titles', () => {
    const candidate = baseCandidate({
      skills: ['Python'],
      headline: 'Airflow pipelines at scale',
      currentTitle: 'Data Engineer',
    })
    const result = applyGates(candidate, { mustHave: ['Python', 'Airflow'] })
    expect(result.passed).toBe(true)
    expect(result.reasons).toEqual([])
  })

  it('does not treat "Java" as satisfying a must-have "JavaScript"', () => {
    const candidate = baseCandidate({ skills: ['Java'] })
    const result = applyGates(candidate, { mustHave: ['JavaScript'] })
    expect(result.passed).toBe(false)
  })

  it('passes when no must-have skills are requested', () => {
    const candidate = baseCandidate()
    expect(applyGates(candidate, {}).passed).toBe(true)
  })
})

describe('applyGates — excluded keywords', () => {
  it('excludes a candidate whose job title contains an excluded keyword', () => {
    const candidate = baseCandidate({ currentTitle: 'Software Engineering Intern' })
    const result = applyGates(candidate, { exclude: ['Intern'] })
    expect(result.passed).toBe(false)
    expect(result.reasons.some((r) => r.includes('Intern'))).toBe(true)
  })

  it('excludes a candidate whose skills list contains an excluded keyword', () => {
    const candidate = baseCandidate({ skills: ['Internship Program'] })
    const result = applyGates(candidate, { exclude: ['Intern'] })
    // "Internship" is a different token from "Intern" under exact-token
    // matching, so this specific phrasing should NOT trigger — verifying
    // the exclusion check uses the same exact-token matcher, not substring.
    expect(result.passed).toBe(true)
  })

  it('excludes based on headline/summary as before, still', () => {
    const candidate = baseCandidate({ summary: 'Currently an intern at a startup' })
    const result = applyGates(candidate, { exclude: ['intern'] })
    expect(result.passed).toBe(false)
  })

  it('passes a clean candidate with no exclusions requested', () => {
    const candidate = baseCandidate({ currentTitle: 'Senior Engineer' })
    expect(applyGates(candidate, {}).passed).toBe(true)
  })
})

describe('applyGates — both gates combine', () => {
  it('reports all failing reasons at once, not just the first', () => {
    const candidate = baseCandidate({ currentTitle: 'Intern' })
    const result = applyGates(candidate, { mustHave: ['Python'], exclude: ['Intern'] })
    expect(result.passed).toBe(false)
    expect(result.reasons).toHaveLength(2)
  })
})
