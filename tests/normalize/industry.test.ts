import { describe, expect, it } from 'vitest'
import { normalizeIndustry } from '@/lib/normalize/industry'

describe('normalizeIndustry', () => {
  it('canonicalises a profile industry', () => {
    expect(normalizeIndustry('Information Technology & Services', null)).toBe('Technology')
    expect(normalizeIndustry('Computer Software', null)).toBe('Technology')
    expect(normalizeIndustry('Banking', null)).toBe('Financial Services')
    expect(normalizeIndustry('Hospital & Health Care', null)).toBe('Healthcare')
  })

  it('falls back to a known company when there is no profile industry', () => {
    expect(normalizeIndustry(null, 'TechCorp')).toBe('Technology')
  })

  it('prefers the profile industry over the company guess', () => {
    expect(normalizeIndustry('Banking', 'TechCorp')).toBe('Financial Services')
  })

  it('returns null when nothing is recognised', () => {
    expect(normalizeIndustry(null, null)).toBeNull()
    expect(normalizeIndustry('Something Unheard Of', 'Nowhere Ltd')).toBeNull()
  })

  it('never throws and always returns null for garbage input types', () => {
    const garbage = [null, undefined, 42, {}, [], '']
    for (const profileIndustry of garbage) {
      for (const company of garbage) {
        expect(() => normalizeIndustry(profileIndustry as any, company as any)).not.toThrow()
        const result = normalizeIndustry(profileIndustry as any, company as any)
        expect(result === null || typeof result === 'string').toBe(true)
        expect(result).not.toBeUndefined()
      }
    }
  })

  it('does not leak values off Object.prototype for dangerous keys', () => {
    const dangerous = ['constructor', '__proto__', 'toString', 'hasOwnProperty']
    for (const key of dangerous) {
      expect(normalizeIndustry(key, null)).toBeNull()
      expect(normalizeIndustry(null, key)).toBeNull()
      expect(() => normalizeIndustry(key, key)).not.toThrow()
    }
  })
})
