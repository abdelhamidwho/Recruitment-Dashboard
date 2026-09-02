import { describe, expect, it } from 'vitest'
import { normalizeLocation } from '@/lib/normalize/location'

describe('normalizeLocation', () => {
  it('resolves a US state abbreviation to the United States', () => {
    expect(normalizeLocation('San Francisco, CA')).toEqual({
      raw: 'San Francisco, CA',
      city: 'San Francisco',
      country: 'United States',
      region: 'North America',
    })
  })

  it('parses city and country', () => {
    expect(normalizeLocation('Cairo, Egypt')).toEqual({
      raw: 'Cairo, Egypt',
      city: 'Cairo',
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('handles a three part location', () => {
    expect(normalizeLocation('Dubai, Dubai, United Arab Emirates')).toEqual({
      raw: 'Dubai, Dubai, United Arab Emirates',
      city: 'Dubai',
      country: 'United Arab Emirates',
      region: 'GCC',
    })
  })

  it('treats work-mode words as no location at all', () => {
    for (const value of ['Remote', 'remote', 'Worldwide', 'Anywhere']) {
      expect(normalizeLocation(value)).toEqual({ raw: value, city: null, country: null, region: null })
    }
  })

  it('keeps the city when the country is unrecognised', () => {
    expect(normalizeLocation('Atlantis, Oceanus')).toEqual({
      raw: 'Atlantis, Oceanus',
      city: 'Atlantis',
      country: null,
      region: null,
    })
  })

  it('recognises a bare country with no city', () => {
    expect(normalizeLocation('Egypt')).toEqual({
      raw: 'Egypt',
      city: null,
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('never throws on empty input', () => {
    expect(normalizeLocation(null)).toEqual({ raw: null, city: null, country: null, region: null })
    expect(normalizeLocation('')).toEqual({ raw: null, city: null, country: null, region: null })
    expect(normalizeLocation('   ')).toEqual({ raw: null, city: null, country: null, region: null })
  })
})
