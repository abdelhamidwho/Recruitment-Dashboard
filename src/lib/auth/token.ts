import { createHash, randomBytes } from 'node:crypto'
import { SESSION_TTL_MS } from './constants'

/**
 * Generates a fresh random session token: 32 bytes, base64url-encoded (URL
 * safe, no padding). This is the value that goes in the session cookie. It
 * is never stored — only its hash (see `hashSessionToken`) is persisted.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Deterministically hashes a session token to a 64-character lowercase hex
 * SHA-256 digest. This is what gets stored as `Session.id` in the database,
 * so a leaked database yields no usable session tokens. Never returns the
 * token it was given. Does not throw for an empty string or a non-string
 * input coerced to one.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(String(token)).digest('hex')
}

/**
 * Returns the instant one session TTL after `now`. `now` defaults to the
 * current time; tests should pass an explicit value for determinism.
 */
export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS)
}

/**
 * Reports whether `expiresAt` is at or before `now`. `now` defaults to the
 * current time; tests should pass an explicit value for determinism. An
 * unparseable `expiresAt` (an invalid Date, e.g. `new Date('nonsense')`)
 * is treated as expired — the safe default for a security check, since
 * `Invalid Date` comparisons are otherwise always `false` and would
 * silently treat a corrupt value as never expiring.
 */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  if (Number.isNaN(expiresAt.getTime())) return true
  return expiresAt.getTime() <= now.getTime()
}
