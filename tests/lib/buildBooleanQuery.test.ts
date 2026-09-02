import { describe, expect, it } from 'vitest'
import { buildBooleanQuery } from '@/lib/buildBooleanQuery'

describe('buildBooleanQuery', () => {
  it('returns an empty string when there are no filters', () => {
    expect(buildBooleanQuery({})).toBe('')
  })

  it('quotes multi-word titles and ORs them together', () => {
    expect(buildBooleanQuery({ titles: ['Backend Engineer', 'Developer'] })).toBe(
      '("Backend Engineer" OR Developer)',
    )
  })

  it('ANDs must-have skills individually', () => {
    expect(buildBooleanQuery({ mustHave: ['Node.js', 'AWS'] })).toBe('Node.js AND AWS')
  })

  it('turns exclusions into NOT terms', () => {
    expect(buildBooleanQuery({ mustHave: ['AWS'], exclude: ['Intern'] })).toBe('AWS NOT Intern')
  })

  it('de-duplicates and trims repeated values', () => {
    expect(buildBooleanQuery({ mustHave: ['AWS', ' AWS ', ''] })).toBe('AWS')
  })
})
