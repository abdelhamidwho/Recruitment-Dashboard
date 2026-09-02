import { describe, expect, it } from 'vitest'
import { canonicalCountry, regionForCountry, KNOWN_COUNTRIES } from '@/lib/normalize/regions'

describe('canonicalCountry', () => {
  it('expands common abbreviations', () => {
    expect(canonicalCountry('UAE')).toBe('United Arab Emirates')
    expect(canonicalCountry('KSA')).toBe('Saudi Arabia')
    expect(canonicalCountry('USA')).toBe('United States')
    expect(canonicalCountry('UK')).toBe('United Kingdom')
  })

  it('is case and whitespace insensitive', () => {
    expect(canonicalCountry('  egypt ')).toBe('Egypt')
  })

  it('returns null for something that is not a country', () => {
    expect(canonicalCountry('Atlantis')).toBeNull()
    expect(canonicalCountry('')).toBeNull()
    expect(canonicalCountry(null)).toBeNull()
  })
})

describe('regionForCountry', () => {
  it('maps Gulf states to GCC', () => {
    expect(regionForCountry('United Arab Emirates')).toBe('GCC')
    expect(regionForCountry('Saudi Arabia')).toBe('GCC')
    expect(regionForCountry('Qatar')).toBe('GCC')
  })

  it('maps non-Gulf Arab states to MENA', () => {
    expect(regionForCountry('Egypt')).toBe('MENA')
    expect(regionForCountry('Morocco')).toBe('MENA')
  })

  it('maps the rest of the world', () => {
    expect(regionForCountry('United States')).toBe('North America')
    expect(regionForCountry('Germany')).toBe('Europe')
    expect(regionForCountry('India')).toBe('South Asia')
  })

  it('accepts an abbreviation and returns null for the unknown', () => {
    expect(regionForCountry('UAE')).toBe('GCC')
    expect(regionForCountry('Atlantis')).toBeNull()
  })
})

describe('prototype chain hardening', () => {
  it('canonicalCountry returns null for prototype chain properties', () => {
    expect(canonicalCountry('constructor')).toBeNull()
    expect(canonicalCountry('__proto__')).toBeNull()
    expect(canonicalCountry('toString')).toBeNull()
    expect(canonicalCountry('hasOwnProperty')).toBeNull()
  })

  it('regionForCountry returns null for prototype chain properties', () => {
    expect(regionForCountry('constructor')).toBeNull()
    expect(regionForCountry('__proto__')).toBeNull()
    expect(regionForCountry('toString')).toBeNull()
    expect(regionForCountry('hasOwnProperty')).toBeNull()
  })

  it('KNOWN_COUNTRIES is frozen and cannot be mutated', () => {
    expect(KNOWN_COUNTRIES).toContain('Egypt')
    const originalLength = KNOWN_COUNTRIES.length
    expect(() => {
      ;(KNOWN_COUNTRIES as any).push('FakeCountry')
    }).toThrow()
    expect(KNOWN_COUNTRIES.length).toBe(originalLength)
  })
})
