import { describe, expect, it } from 'vitest'
import {
  applyFacetSelection,
  computeFacetValues,
  computeFacets,
  computeFacetsForDisplay,
  FACET_DIMENSIONS,
  FacetableCandidate,
  NOT_SPECIFIED,
  NOT_SPECIFIED_LABEL,
} from '@/lib/facets'

function candidate(overrides: Partial<FacetableCandidate> = {}): FacetableCandidate {
  return {
    country: null,
    region: null,
    city: null,
    industry: null,
    highestDegree: null,
    fieldsOfStudy: '[]',
    languages: '[]',
    source: null,
    totalYearsExperience: null,
    wasKnownBefore: false,
    ...overrides,
  }
}

describe('computeFacetValues — scalar dimensions', () => {
  it('counts each distinct value present', () => {
    const candidates = [
      candidate({ country: 'Egypt' }),
      candidate({ country: 'Egypt' }),
      candidate({ country: 'UAE' }),
    ]
    const values = computeFacetValues(candidates, 'country')
    expect(values).toEqual([
      { value: 'egypt', label: 'Egypt', count: 2 },
      { value: 'uae', label: 'UAE', count: 1 },
    ])
  })

  it('groups case-insensitively but keeps a readable display label', () => {
    const candidates = [
      candidate({ city: 'cairo' }),
      candidate({ city: 'Cairo' }),
      candidate({ city: 'CAIRO' }),
    ]
    const values = computeFacetValues(candidates, 'city')
    expect(values).toHaveLength(1)
    expect(values[0]).toMatchObject({ value: 'cairo', count: 3 })
    // First-seen casing is preserved for display.
    expect(values[0].label).toBe('cairo')
  })

  it('buckets missing values under an explicit NOT_SPECIFIED entry', () => {
    const candidates = [candidate({ country: 'Egypt' }), candidate({ country: null }), candidate({ country: '' })]
    const values = computeFacetValues(candidates, 'country')
    const notSpecified = values.find((v) => v.value === NOT_SPECIFIED)
    expect(notSpecified).toEqual({ value: NOT_SPECIFIED, label: NOT_SPECIFIED_LABEL, count: 2 })
    const total = values.reduce((sum, v) => sum + v.count, 0)
    expect(total).toBe(candidates.length)
  })
})

describe('computeFacetValues — fieldsOfStudy (JSON array)', () => {
  it('tallies each field across candidates, not the serialized string', () => {
    const candidates = [
      candidate({ fieldsOfStudy: JSON.stringify(['Computer Science', 'Mathematics']) }),
      candidate({ fieldsOfStudy: JSON.stringify(['Computer Science']) }),
      candidate({ fieldsOfStudy: JSON.stringify(['Mathematics']) }),
    ]
    const values = computeFacetValues(candidates, 'fieldsOfStudy')
    expect(values).toEqual(
      expect.arrayContaining([
        { value: 'computer science', label: 'Computer Science', count: 2 },
        { value: 'mathematics', label: 'Mathematics', count: 2 },
      ]),
    )
  })

  it('counts a candidate with no fields toward NOT_SPECIFIED', () => {
    const candidates = [
      candidate({ fieldsOfStudy: '[]' }),
      candidate({ fieldsOfStudy: null }),
      candidate({ fieldsOfStudy: JSON.stringify(['Physics']) }),
    ]
    const values = computeFacetValues(candidates, 'fieldsOfStudy')
    expect(values.find((v) => v.value === NOT_SPECIFIED)?.count).toBe(2)
  })

  it('does not double count a duplicated field within one candidate', () => {
    const candidates = [candidate({ fieldsOfStudy: JSON.stringify(['Physics', 'Physics']) })]
    const values = computeFacetValues(candidates, 'fieldsOfStudy')
    expect(values).toEqual([{ value: 'physics', label: 'Physics', count: 1 }])
  })

  it('tolerates malformed JSON without throwing, treating it as no values', () => {
    const candidates = [candidate({ fieldsOfStudy: 'not json' })]
    expect(() => computeFacetValues(candidates, 'fieldsOfStudy')).not.toThrow()
    const values = computeFacetValues(candidates, 'fieldsOfStudy')
    expect(values).toEqual([{ value: NOT_SPECIFIED, label: NOT_SPECIFIED_LABEL, count: 1 }])
  })
})

describe('computeFacetValues — languages (JSON array of {name, level})', () => {
  it('tallies by name+level combination', () => {
    const candidates = [
      candidate({ languages: JSON.stringify([{ name: 'English', level: 'Fluent' }]) }),
      candidate({ languages: JSON.stringify([{ name: 'English', level: 'Fluent' }, { name: 'Arabic', level: 'Native' }]) }),
    ]
    const values = computeFacetValues(candidates, 'languages')
    expect(values).toEqual(
      expect.arrayContaining([
        { value: 'english (fluent)', label: 'English (Fluent)', count: 2 },
        { value: 'arabic (native)', label: 'Arabic (Native)', count: 1 },
      ]),
    )
  })
})

describe('computeFacetValues — years of experience buckets', () => {
  it('buckets sensibly and keeps display order ordinal, not by count', () => {
    const candidates = [
      candidate({ totalYearsExperience: 16 }),
      candidate({ totalYearsExperience: 1 }),
      candidate({ totalYearsExperience: 1 }),
      candidate({ totalYearsExperience: 1 }),
    ]
    const values = computeFacetValues(candidates, 'yearsExperience')
    expect(values.map((v) => v.value)).toEqual(['0-2', '15+'])
    expect(values.find((v) => v.value === '0-2')?.count).toBe(3)
  })

  it('puts missing experience in NOT_SPECIFIED, last', () => {
    const candidates = [candidate({ totalYearsExperience: null }), candidate({ totalYearsExperience: 5 })]
    const values = computeFacetValues(candidates, 'yearsExperience')
    expect(values[values.length - 1].value).toBe(NOT_SPECIFIED)
  })
})

describe('computeFacetValues — wasKnownBefore', () => {
  it('splits into seen-before / new / not specified', () => {
    const candidates = [
      candidate({ wasKnownBefore: true }),
      candidate({ wasKnownBefore: false }),
      candidate({ wasKnownBefore: undefined }),
    ]
    const values = computeFacetValues(candidates, 'wasKnownBefore')
    expect(values).toEqual([
      { value: 'true', label: 'Seen before', count: 1 },
      { value: 'false', label: 'New', count: 1 },
      { value: NOT_SPECIFIED, label: NOT_SPECIFIED_LABEL, count: 1 },
    ])
  })
})

describe('computeFacets', () => {
  it('produces one group per dimension and counts add up to the total for each', () => {
    const candidates = [
      candidate({ country: 'Egypt', city: 'Cairo' }),
      candidate({ country: null, city: null }),
      candidate({ country: 'UAE', city: 'Dubai' }),
    ]
    const groups = computeFacets(candidates)
    expect(groups.map((g) => g.key)).toEqual(FACET_DIMENSIONS)
    for (const group of groups) {
      const total = group.values.reduce((sum, v) => sum + v.count, 0)
      expect(total).toBe(candidates.length)
    }
  })
})

describe('applyFacetSelection', () => {
  const candidates = [
    candidate({ country: 'Egypt', industry: 'Software' }),
    candidate({ country: 'Egypt', industry: 'Finance' }),
    candidate({ country: 'UAE', industry: 'Software' }),
    candidate({ country: null, industry: 'Software' }),
  ].map((c, i) => ({ ...c, id: i }))

  it('returns everything when nothing is selected', () => {
    expect(applyFacetSelection(candidates, {})).toHaveLength(4)
  })

  it('narrows to a single selected value within a dimension', () => {
    const result = applyFacetSelection(candidates, { country: ['egypt'] })
    expect(result).toHaveLength(2)
    expect(result.every((c) => c.country === 'Egypt')).toBe(true)
  })

  it('within one dimension, multiple selections read as "any of these" (OR)', () => {
    const result = applyFacetSelection(candidates, { country: ['egypt', 'uae'] })
    expect(result).toHaveLength(3)
  })

  it('across dimensions, selections combine as "all of these" (AND)', () => {
    const result = applyFacetSelection(candidates, { country: ['egypt'], industry: ['finance'] })
    expect(result).toHaveLength(1)
    expect(result[0].industry).toBe('Finance')
  })

  it('can select the NOT_SPECIFIED bucket to filter on missing data', () => {
    const result = applyFacetSelection(candidates, { country: [NOT_SPECIFIED] })
    expect(result).toHaveLength(1)
    expect(result[0].country).toBeNull()
  })

  it('an empty array for a dimension imposes no constraint (treated as cleared)', () => {
    const result = applyFacetSelection(candidates, { country: [] })
    expect(result).toHaveLength(4)
  })
})

describe('computeFacetsForDisplay', () => {
  const candidates = [
    candidate({ country: 'Egypt', industry: 'Software' }),
    candidate({ country: 'Egypt', industry: 'Finance' }),
    candidate({ country: 'UAE', industry: 'Software' }),
    candidate({ country: null, industry: 'Software' }),
  ]

  it('with no selection, matches computeFacets', () => {
    expect(computeFacetsForDisplay(candidates, {})).toEqual(computeFacets(candidates))
  })

  it("a dimension's own selection does not collapse its own displayed values", () => {
    const groups = computeFacetsForDisplay(candidates, { country: ['egypt'] })
    const countryGroup = groups.find((g) => g.key === 'country')!
    // UAE must still be visible (with its own count) even though "egypt" is selected,
    // so the user can add it as a second "any of these" choice.
    expect(countryGroup.values.map((v) => v.value)).toEqual(expect.arrayContaining(['egypt', 'uae']))
  })

  it("other dimensions' counts narrow to reflect the active selection", () => {
    const groups = computeFacetsForDisplay(candidates, { country: ['egypt'] })
    const industryGroup = groups.find((g) => g.key === 'industry')!
    // Only the two Egypt candidates remain when computing industry counts.
    const total = industryGroup.values.reduce((sum, v) => sum + v.count, 0)
    expect(total).toBe(2)
    expect(industryGroup.values).toEqual(
      expect.arrayContaining([
        { value: 'software', label: 'Software', count: 1 },
        { value: 'finance', label: 'Finance', count: 1 },
      ]),
    )
  })
})
