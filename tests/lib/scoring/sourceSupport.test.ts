import { describe, expect, it } from 'vitest'
import { allUnsupported, unsupportedFieldsFor } from '@/lib/scoring/sourceSupport'

describe('unsupportedFieldsFor', () => {
  it('returns GitHub\'s known-unsupported fields', () => {
    const unsupported = unsupportedFieldsFor('github')
    expect(unsupported.has('education')).toBe(true)
    expect(unsupported.has('industry')).toBe(true)
    expect(unsupported.has('languages')).toBe(true)
    expect(unsupported.has('totalYearsExperience')).toBe(true)
    expect(unsupported.has('experience')).toBe(true)
  })

  it('returns an empty set for no source id (assume full support)', () => {
    expect(unsupportedFieldsFor(undefined).size).toBe(0)
    expect(unsupportedFieldsFor(null).size).toBe(0)
  })

  it('returns an empty set for "apify", which is not in the registry but supports every field', () => {
    expect(unsupportedFieldsFor('apify').size).toBe(0)
  })

  it('fails open (empty set) for an unknown source id rather than throwing', () => {
    expect(() => unsupportedFieldsFor('not-a-real-source')).not.toThrow()
    expect(unsupportedFieldsFor('not-a-real-source').size).toBe(0)
  })
})

describe('allUnsupported', () => {
  it('is true only when every named field is unsupported', () => {
    const unsupported = unsupportedFieldsFor('github')
    expect(allUnsupported(unsupported, ['education'])).toBe(true)
    expect(allUnsupported(unsupported, ['education', 'industry'])).toBe(true)
    expect(allUnsupported(unsupported, ['education', 'location'])).toBe(false) // location IS supported by GitHub
  })

  it('is false for an empty field list', () => {
    expect(allUnsupported(unsupportedFieldsFor('github'), [])).toBe(false)
  })
})
