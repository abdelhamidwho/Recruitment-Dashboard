import { describe, expect, it } from 'vitest'
import { totalYearsOfExperience } from '@/lib/normalize/experience'

const NOW = new Date('2026-01-01T00:00:00Z')

describe('totalYearsOfExperience', () => {
  it('returns null when there is nothing to measure', () => {
    expect(totalYearsOfExperience([], NOW)).toBeNull()
    expect(totalYearsOfExperience(null, NOW)).toBeNull()
    expect(totalYearsOfExperience([{ title: 'Dev' }], NOW)).toBeNull()
  })

  it('sums durationMonths when no dates are given', () => {
    expect(
      totalYearsOfExperience([{ durationMonths: 36 }, { durationMonths: 24 }], NOW),
    ).toBe(5)
  })

  it('merges overlapping date ranges instead of double counting', () => {
    expect(
      totalYearsOfExperience(
        [
          { from: '2020-01-01', to: '2022-01-01' },
          { from: '2021-01-01', to: '2023-01-01' },
        ],
        NOW,
      ),
    ).toBe(3)
  })

  it('keeps separate date ranges separate', () => {
    expect(
      totalYearsOfExperience(
        [
          { from: '2018-01-01', to: '2019-01-01' },
          { from: '2021-01-01', to: '2023-01-01' },
        ],
        NOW,
      ),
    ).toBe(3)
  })

  it('treats a missing end date as still employed', () => {
    expect(totalYearsOfExperience([{ from: '2024-01-01' }], NOW)).toBe(2)
  })

  it('adds duration-only entries to date-based ones', () => {
    expect(
      totalYearsOfExperience(
        [{ from: '2022-01-01', to: '2024-01-01' }, { durationMonths: 12 }],
        NOW,
      ),
    ).toBe(3)
  })

  it('ignores unparseable dates rather than throwing', () => {
    expect(totalYearsOfExperience([{ from: 'sometime', to: 'later' }], NOW)).toBeNull()
  })

  it('rounds to one decimal place', () => {
    expect(totalYearsOfExperience([{ durationMonths: 7 }], NOW)).toBe(0.6)
  })
})
