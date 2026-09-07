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

  it('drops work-mode words from parts, leaving country alone', () => {
    expect(normalizeLocation('Remote, United States')).toEqual({
      raw: 'Remote, United States',
      city: null,
      country: 'United States',
      region: 'North America',
    })
  })

  it('strips parenthesised groups before parsing', () => {
    expect(normalizeLocation('Cairo, Egypt (Remote)')).toEqual({
      raw: 'Cairo, Egypt (Remote)',
      city: 'Cairo',
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('returns all nulls when all segments are work-mode words', () => {
    expect(normalizeLocation('Remote, Remote')).toEqual({
      raw: 'Remote, Remote',
      city: null,
      country: null,
      region: null,
    })
  })

  it('strips nested parentheses without leaving stray punctuation', () => {
    expect(normalizeLocation('(())')).toEqual({
      raw: '(())',
      city: null,
      country: null,
      region: null,
    })
    // "A ((B)) C" strips to "A C" with no stray parens
    expect(normalizeLocation('A ((B)) C')).toEqual({
      raw: 'A ((B)) C',
      city: 'A C',
      country: null,
      region: null,
    })
  })

  it('strips multi-part parenthetical notes', () => {
    expect(normalizeLocation('Cairo, Egypt (Remote, Hybrid)')).toEqual({
      raw: 'Cairo, Egypt (Remote, Hybrid)',
      city: 'Cairo',
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('handles a reversed country-then-city order with no space after the comma', () => {
    expect(normalizeLocation('Egypt,Cairo')).toEqual({
      raw: 'Egypt,Cairo',
      city: 'Cairo',
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('handles a reversed country-then-city order with a space after the comma', () => {
    expect(normalizeLocation('Egypt, Cairo')).toEqual({
      raw: 'Egypt, Cairo',
      city: 'Cairo',
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('handles a reversed country-then-city order for a country written as a full name', () => {
    expect(normalizeLocation('United States, San Francisco')).toEqual({
      raw: 'United States, San Francisco',
      city: 'San Francisco',
      country: 'United States',
      region: 'North America',
    })
  })

  it('normalises an all-lowercase city to title case', () => {
    expect(normalizeLocation('cairo,egypt')).toEqual({
      raw: 'cairo,egypt',
      city: 'Cairo',
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('normalises an all-uppercase city to title case', () => {
    expect(normalizeLocation('CAIRO, EGYPT')).toEqual({
      raw: 'CAIRO, EGYPT',
      city: 'Cairo',
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('leaves a mixed-case multi-word city untouched', () => {
    expect(normalizeLocation('Rio de Janeiro, Brazil')).toEqual({
      raw: 'Rio de Janeiro, Brazil',
      city: 'Rio de Janeiro',
      country: 'Brazil',
      region: 'Latin America',
    })
  })

  it('leaves an already-normal mixed-case city untouched', () => {
    expect(normalizeLocation('San Francisco, CA')).toEqual({
      raw: 'San Francisco, CA',
      city: 'San Francisco',
      country: 'United States',
      region: 'North America',
    })
  })

  it('title-cases each segment of an all-lowercase hyphenated city', () => {
    expect(normalizeLocation('sharm-el-sheikh, egypt')).toEqual({
      raw: 'sharm-el-sheikh, egypt',
      city: 'Sharm-El-Sheikh',
      country: 'Egypt',
      region: 'MENA',
    })
  })

  it('does not reorder when several other segments could be countries', () => {
    expect(normalizeLocation('France, Germany, Somewhere')).toEqual({
      raw: 'France, Germany, Somewhere',
      city: 'France',
      country: null,
      region: null,
    })
  })

  it('never throws on hostile input', () => {
    expect(() => normalizeLocation(undefined)).not.toThrow()
    expect(() => normalizeLocation('')).not.toThrow()
    expect(() => normalizeLocation(',')).not.toThrow()
    expect(() => normalizeLocation(',,,')).not.toThrow()
    expect(() => normalizeLocation('(())')).not.toThrow()
    expect(() => normalizeLocation('constructor')).not.toThrow()
    expect(() => normalizeLocation('__proto__')).not.toThrow()
    expect(() => normalizeLocation('!!!???')).not.toThrow()
    expect(() => normalizeLocation('x'.repeat(50000))).not.toThrow()
  })
})
