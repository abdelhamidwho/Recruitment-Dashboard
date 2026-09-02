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

  it('deliberately treats an unparseable "to" the same as an ongoing role, measured through now', () => {
    const expected = totalYearsOfExperience([{ from: '2024-01-01' }], NOW)
    expect(totalYearsOfExperience([{ from: '2024-01-01', to: 'Present' }], NOW)).toBe(expected)
    expect(totalYearsOfExperience([{ from: '2024-01-01', to: 'Current' }], NOW)).toBe(expected)
    expect(totalYearsOfExperience([{ from: '2024-01-01', to: 'garbage' }], NOW)).toBe(expected)
  })

  it('deliberately falls back to durationMonths for a reversed or zero-length range, never returning a negative number', () => {
    expect(
      totalYearsOfExperience(
        [{ from: '2024-01-01', to: '2020-01-01', durationMonths: 12 }],
        NOW,
      ),
    ).toBe(1)
    expect(
      totalYearsOfExperience([{ from: '2024-01-01', to: '2020-01-01' }], NOW),
    ).toBeNull()
  })

  it('skips non-object array elements instead of throwing, and still counts the good ones', () => {
    expect(
      totalYearsOfExperience([null as any, { durationMonths: 12 }], NOW),
    ).toBe(1)
  })

  it('returns null without throwing when every array element is junk', () => {
    expect(totalYearsOfExperience([null as any], NOW)).toBeNull()
    expect(totalYearsOfExperience([undefined as any], NOW)).toBeNull()
    expect(
      totalYearsOfExperience([null as any, 42 as any, 'text' as any, [] as any], NOW),
    ).toBeNull()
  })

  it('treats non-string from/to as absent and falls back to durationMonths', () => {
    expect(
      totalYearsOfExperience(
        [{ from: 42 as any, to: {} as any, durationMonths: 12 }],
        NOW,
      ),
    ).toBe(1)
  })
})
