import { describe, expect, it } from 'vitest'
import { generateSessionToken, hashSessionToken, isExpired, sessionExpiry } from '@/lib/auth/token'
import { SESSION_TTL_MS } from '@/lib/auth/constants'

describe('session tokens', () => {
  it('generates a distinct url-safe token each time', () => {
    const a = generateSessionToken()
    const b = generateSessionToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a.length).toBeGreaterThanOrEqual(40)
  })

  it('hashes a token deterministically to hex', () => {
    expect(hashSessionToken('abc')).toBe(hashSessionToken('abc'))
    expect(hashSessionToken('abc')).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSessionToken('abc')).not.toBe(hashSessionToken('abd'))
  })

  it('never returns the token itself as the hash', () => {
    const token = generateSessionToken()
    expect(hashSessionToken(token)).not.toBe(token)
  })

  it('computes an expiry one TTL into the future', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(sessionExpiry(now).getTime()).toBe(now.getTime() + SESSION_TTL_MS)
  })

  it('detects expiry against a supplied clock', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(isExpired(new Date('2025-12-31T23:59:59Z'), now)).toBe(true)
    expect(isExpired(new Date('2026-01-01T00:00:01Z'), now)).toBe(false)
    expect(isExpired(now, now)).toBe(true)
  })

  it('does not throw hashing an empty or non-string token', () => {
    expect(() => hashSessionToken('')).not.toThrow()
    expect(hashSessionToken('')).toMatch(/^[0-9a-f]{64}$/)
    expect(() => hashSessionToken(null as unknown as string)).not.toThrow()
  })

  it('treats an unparseable expiry as expired', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(isExpired(new Date('nonsense'), now)).toBe(true)
  })

  it('produces 1000 unique url-safe tokens with no padding', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const token = generateSessionToken()
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      tokens.add(token)
    }
    expect(tokens.size).toBe(1000)
  })
})
