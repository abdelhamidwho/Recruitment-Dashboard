import { describe, expect, it } from 'vitest'
import { normalizeLanguages } from '@/lib/normalize/languages'

describe('normalizeLanguages', () => {
  it('accepts bare strings with an unknown level', () => {
    expect(normalizeLanguages(['English'])).toEqual([{ name: 'English', level: null }])
  })

  it('maps LinkedIn proficiency sentences to levels', () => {
    expect(
      normalizeLanguages([
        { name: 'Arabic', proficiency: 'Native or bilingual proficiency' },
        { name: 'English', proficiency: 'Full professional proficiency' },
        { name: 'French', proficiency: 'Professional working proficiency' },
        { name: 'German', proficiency: 'Limited working proficiency' },
        { name: 'Spanish', proficiency: 'Elementary proficiency' },
      ]),
    ).toEqual([
      { name: 'Arabic', level: 'Native' },
      { name: 'English', level: 'Full professional' },
      { name: 'French', level: 'Professional' },
      { name: 'German', level: 'Limited' },
      { name: 'Spanish', level: 'Elementary' },
    ])
  })

  it('accepts level under alternative key names', () => {
    expect(normalizeLanguages([{ name: 'Arabic', level: 'Native' }])).toEqual([
      { name: 'Arabic', level: 'Native' },
    ])
  })

  it('leaves an unrecognised proficiency as null', () => {
    expect(normalizeLanguages([{ name: 'Urdu', proficiency: 'quite good' }])).toEqual([
      { name: 'Urdu', level: null },
    ])
  })

  it('drops entries with no usable name and never throws', () => {
    expect(normalizeLanguages(null)).toEqual([])
    expect(normalizeLanguages('English')).toEqual([])
    expect(normalizeLanguages([{ proficiency: 'Native' }, '', 42])).toEqual([])
  })

  it('de-duplicates by name, keeping the first level seen', () => {
    expect(
      normalizeLanguages([
        { name: 'English', proficiency: 'Native or bilingual proficiency' },
        { name: 'English' },
      ]),
    ).toEqual([{ name: 'English', level: 'Native' }])
  })

  it('de-duplication is case-insensitive but preserves first-seen casing', () => {
    expect(
      normalizeLanguages([
        { name: 'English', proficiency: 'Native or bilingual proficiency' },
        { name: 'english' },
      ]),
    ).toEqual([{ name: 'English', level: 'Native' }])
  })

  it('treats a non-string name as absent and drops the entry', () => {
    expect(normalizeLanguages([{ name: 42 }])).toEqual([])
    expect(normalizeLanguages([{ name: {} }])).toEqual([])
    expect(normalizeLanguages([{ name: [] }])).toEqual([])
    expect(normalizeLanguages([{ language: 99 }])).toEqual([])
  })

  it('skips junk array elements without failing the whole array', () => {
    expect(normalizeLanguages([null, { name: 'Arabic' }])).toEqual([{ name: 'Arabic', level: null }])
    expect(normalizeLanguages([undefined, 'French'])).toEqual([{ name: 'French', level: null }])
    expect(normalizeLanguages([null, undefined, 42, [], {}])).toEqual([])
  })

  it('returns [] for non-array input', () => {
    expect(normalizeLanguages(null)).toEqual([])
    expect(normalizeLanguages(undefined)).toEqual([])
    expect(normalizeLanguages('English')).toEqual([])
    expect(normalizeLanguages(42)).toEqual([])
    expect(normalizeLanguages({})).toEqual([])
  })

  it('treats a non-string proficiency or level as absent, yielding level: null', () => {
    expect(normalizeLanguages([{ name: 'Arabic', proficiency: 42 }])).toEqual([
      { name: 'Arabic', level: null },
    ])
    expect(normalizeLanguages([{ name: 'Arabic', level: {} }])).toEqual([{ name: 'Arabic', level: null }])
  })
})
