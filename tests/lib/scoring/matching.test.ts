import { describe, expect, it } from 'vitest'
import { canonicalizeTerm, matchesTerm, tokenize } from '@/lib/scoring/matching'

describe('canonicalizeTerm', () => {
  it('unifies Node.js spellings', () => {
    const canonical = canonicalizeTerm('Node.js')
    expect(canonicalizeTerm('node')).toBe(canonical)
    expect(canonicalizeTerm('NodeJS')).toBe(canonical)
    expect(canonicalizeTerm('node.js')).toBe(canonical)
    expect(canonicalizeTerm('Node JS')).toBe(canonical)
  })

  it('keeps Java and JavaScript distinct', () => {
    expect(canonicalizeTerm('Java')).not.toBe(canonicalizeTerm('JavaScript'))
    expect(canonicalizeTerm('Java')).toBe('java')
    expect(canonicalizeTerm('JavaScript')).toBe('javascript')
  })

  it('normalizes case and whitespace for an unrecognised term', () => {
    expect(canonicalizeTerm('  Terraform  ')).toBe('terraform')
    expect(canonicalizeTerm('TERRAFORM')).toBe('terraform')
  })

  it('returns "" for non-string/blank input without throwing', () => {
    expect(canonicalizeTerm(undefined)).toBe('')
    expect(canonicalizeTerm(null)).toBe('')
    expect(canonicalizeTerm('   ')).toBe('')
    expect(canonicalizeTerm(42)).toBe('')
  })
})

describe('tokenize', () => {
  it('splits free text into lowercase word tokens', () => {
    expect(tokenize('Senior Java Developer')).toEqual(['senior', 'java', 'developer'])
  })

  it('preserves dotted/symbol tokens like node.js and c++', () => {
    expect(tokenize('Experienced Node.js and C++ engineer')).toEqual([
      'experienced',
      'node.js',
      'and',
      'c++',
      'engineer',
    ])
  })

  it('returns [] for non-string input', () => {
    expect(tokenize(undefined)).toEqual([])
    expect(tokenize(null)).toEqual([])
  })
})

describe('matchesTerm', () => {
  it('matches Node.js against node/nodejs/node.js variants in skills', () => {
    expect(matchesTerm('node', { skills: ['Node.js'] }).matched).toBe(true)
    expect(matchesTerm('Node.js', { skills: ['NodeJS'] }).matched).toBe(true)
    expect(matchesTerm('NODEJS', { skills: ['node js'] }).matched).toBe(true)
  })

  it('does not match Java against JavaScript, in skills or free text', () => {
    expect(matchesTerm('Java', { skills: ['JavaScript'] }).matched).toBe(false)
    expect(matchesTerm('Java', { textFields: { headline: 'Senior JavaScript Engineer' } }).matched).toBe(false)
  })

  it('does not let a one-letter skill match unrelated words (the "R" bug)', () => {
    expect(matchesTerm('R', { textFields: { summary: 'Experienced in Marketing and Sales' } }).matched).toBe(
      false,
    )
    expect(matchesTerm('R', { skills: ['Marketing'] }).matched).toBe(false)
  })

  it('does match a one-letter skill when it truly appears as its own token', () => {
    expect(matchesTerm('R', { skills: ['R'] }).matched).toBe(true)
    expect(matchesTerm('R', { textFields: { summary: 'Data analysis in R and Python' } }).matched).toBe(true)
  })

  it('searches headline, summary, current title, and past job titles, not just skills', () => {
    const haystack = {
      skills: [] as string[],
      textFields: {
        headline: 'Data pipelines with Airflow and dbt',
        summary: undefined,
        'current title': undefined,
        'past job titles': '',
      },
    }
    expect(matchesTerm('Airflow', haystack).matched).toBe(true)
    expect(matchesTerm('Airflow', haystack).where).toEqual(['headline'])
  })

  it('matches a multi-word term via free-text n-grams', () => {
    const result = matchesTerm('Machine Learning', {
      textFields: { summary: 'I build machine learning pipelines' },
    })
    expect(result.matched).toBe(true)
  })

  it('reports where a match was found', () => {
    const result = matchesTerm('Python', { skills: ['Python', 'Go'] })
    expect(result.where).toEqual(['skills'])
  })

  it('does not match when the term is blank', () => {
    expect(matchesTerm('', { skills: ['Python'] }).matched).toBe(false)
    expect(matchesTerm('   ', { skills: ['Python'] }).matched).toBe(false)
  })
})
