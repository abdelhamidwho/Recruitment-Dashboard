import { describe, expect, it } from 'vitest'
import { listSources, isCompleteSourceDescription, APIFY_SOURCE_DESCRIPTION, UNAVAILABLE_SOURCES } from '@/lib/sources'
import { githubSource } from '@/lib/sources/github'

/**
 * Guards the requirement that every registered source carries a complete,
 * honest description — not just a `description` field that satisfies the
 * TS type, but one whose text/lists are actually filled in. A future
 * source registered in ./index.ts without one fails this test rather than
 * silently rendering an empty explanation panel.
 */
describe('every registered source has a complete description', () => {
  it('listSources() sources all pass isCompleteSourceDescription', () => {
    const sources = listSources()
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(isCompleteSourceDescription(source.description)).toBe(true)
    }
  })
})

describe('isCompleteSourceDescription', () => {
  const valid = {
    searches: 'x',
    reliablyReturns: ['a'],
    cannotProvide: ['b'],
    cost: 'Free',
    setupAndLimits: 'none',
    readyNow: true,
  }

  it('accepts a fully filled-in description', () => {
    expect(isCompleteSourceDescription(valid)).toBe(true)
  })

  it('rejects undefined/null', () => {
    expect(isCompleteSourceDescription(undefined)).toBe(false)
    expect(isCompleteSourceDescription(null)).toBe(false)
  })

  it('rejects blank or missing text fields', () => {
    expect(isCompleteSourceDescription({ ...valid, searches: '' })).toBe(false)
    expect(isCompleteSourceDescription({ ...valid, searches: '   ' })).toBe(false)
    expect(isCompleteSourceDescription({ ...valid, cost: '' })).toBe(false)
    expect(isCompleteSourceDescription({ ...valid, setupAndLimits: '' })).toBe(false)
  })

  it('rejects empty or non-string list entries', () => {
    expect(isCompleteSourceDescription({ ...valid, reliablyReturns: [] })).toBe(false)
    expect(isCompleteSourceDescription({ ...valid, cannotProvide: [] })).toBe(false)
    expect(isCompleteSourceDescription({ ...valid, reliablyReturns: [''] })).toBe(false)
  })

  it('rejects a non-boolean readyNow', () => {
    expect(isCompleteSourceDescription({ ...valid, readyNow: undefined as unknown as boolean })).toBe(false)
  })
})

describe("GitHub's description", () => {
  const d = githubSource.description

  it('is honest that it does not search LinkedIn, Indeed, or Glassdoor', () => {
    expect(d.searches).toMatch(/GitHub/)
    expect(d.searches.toLowerCase()).toContain('does not search')
    expect(d.searches).toContain('LinkedIn')
    expect(d.searches).toContain('Indeed')
    expect(d.searches).toContain('Glassdoor')
  })

  it('states it is free and ready with no setup', () => {
    expect(d.cost.toLowerCase()).toContain('free')
    expect(d.readyNow).toBe(true)
  })

  it('lists the fields it genuinely cannot provide', () => {
    expect(d.cannotProvide.join(' ')).toMatch(/employment history|years of experience/i)
    expect(d.cannotProvide.join(' ')).toMatch(/education/i)
  })
})

describe("Apify/LinkedIn's description", () => {
  it('is honest that it is not configured/ready', () => {
    expect(APIFY_SOURCE_DESCRIPTION.readyNow).toBe(false)
    expect(APIFY_SOURCE_DESCRIPTION.cost.toLowerCase()).toContain('paid')
    expect(APIFY_SOURCE_DESCRIPTION.searches).toContain('LinkedIn')
  })

  it('passes the same completeness check required of registered sources', () => {
    expect(isCompleteSourceDescription(APIFY_SOURCE_DESCRIPTION)).toBe(true)
  })
})

describe('UNAVAILABLE_SOURCES', () => {
  it('lists Indeed and Glassdoor, each with a one-line reason', () => {
    const ids = UNAVAILABLE_SOURCES.map((s) => s.id)
    expect(ids).toContain('indeed')
    expect(ids).toContain('glassdoor')
    for (const s of UNAVAILABLE_SOURCES) {
      expect(s.reason.trim().length).toBeGreaterThan(0)
      expect(s.reason).not.toContain('\n')
    }
  })

  it('explains Indeed lists postings, not candidates', () => {
    const indeed = UNAVAILABLE_SOURCES.find((s) => s.id === 'indeed')!
    expect(indeed.reason.toLowerCase()).toContain('job postings')
  })

  it('explains Glassdoor holds reviews/salary data, not candidate profiles', () => {
    const glassdoor = UNAVAILABLE_SOURCES.find((s) => s.id === 'glassdoor')!
    expect(glassdoor.reason.toLowerCase()).toContain('reviews')
  })
})
