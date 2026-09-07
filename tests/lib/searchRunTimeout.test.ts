import { describe, expect, it } from 'vitest'
import { isSearchRunTimedOut, searchRunTimeoutReason, SEARCH_RUN_TIMEOUT_MS } from '@/lib/searchRunTimeout'

describe('isSearchRunTimedOut', () => {
  const startedAt = new Date('2026-01-01T00:00:00.000Z')

  it('is false while comfortably within the threshold', () => {
    const now = new Date(startedAt.getTime() + 60_000)
    expect(isSearchRunTimedOut('RUNNING', startedAt, now)).toBe(false)
    expect(isSearchRunTimedOut('READY', startedAt, now)).toBe(false)
  })

  it('is true once RUNNING has exceeded the threshold', () => {
    const now = new Date(startedAt.getTime() + SEARCH_RUN_TIMEOUT_MS + 1)
    expect(isSearchRunTimedOut('RUNNING', startedAt, now)).toBe(true)
  })

  it('is true once READY has exceeded the threshold', () => {
    const now = new Date(startedAt.getTime() + SEARCH_RUN_TIMEOUT_MS + 1)
    expect(isSearchRunTimedOut('READY', startedAt, now)).toBe(true)
  })

  it('is false exactly at the threshold boundary (strictly greater-than)', () => {
    const now = new Date(startedAt.getTime() + SEARCH_RUN_TIMEOUT_MS)
    expect(isSearchRunTimedOut('RUNNING', startedAt, now)).toBe(false)
  })

  it('never times out a terminal status, no matter how old', () => {
    const longAfter = new Date(startedAt.getTime() + SEARCH_RUN_TIMEOUT_MS * 100)
    for (const status of ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']) {
      expect(isSearchRunTimedOut(status, startedAt, longAfter)).toBe(false)
    }
  })
})

describe('searchRunTimeoutReason', () => {
  it('mentions the elapsed minutes and reads as an explanation, not a stack trace', () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z')
    const now = new Date(startedAt.getTime() + 20 * 60_000)
    const reason = searchRunTimeoutReason(startedAt, now)
    expect(reason).toMatch(/20 minutes/)
    expect(reason).toMatch(/TIMED-OUT/)
  })
})
