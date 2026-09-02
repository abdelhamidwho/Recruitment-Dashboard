import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('password hashing', () => {
  it('accepts the correct password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false)
    expect(await verifyPassword('', hash)).toBe(false)
  })

  it('produces a different hash every time for the same password', async () => {
    const a = await hashPassword('same password')
    const b = await hashPassword('same password')
    expect(a).not.toBe(b)
    expect(await verifyPassword('same password', b)).toBe(true)
  })

  it('records the algorithm and parameters in the stored value', async () => {
    const hash = await hashPassword('whatever')
    expect(hash.split('$')[0]).toBe('scrypt')
    expect(hash.split('$')).toHaveLength(6)
  })

  it('returns false rather than throwing on a malformed stored hash', async () => {
    expect(await verifyPassword('x', '')).toBe(false)
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('x', 'scrypt$1$2$3$notbase64$alsonot')).toBe(false)
  })

  it('refuses to hash an empty password', async () => {
    await expect(hashPassword('')).rejects.toThrow(/password/i)
  })

  it('returns false for non-numeric parameters in the stored hash', async () => {
    expect(await verifyPassword('x', 'scrypt$abc$def$ghi$c2FsdA==$a2V5')).toBe(false)
  })

  it('returns false and does not hang or exhaust memory for absurd scrypt parameters', async () => {
    const salt = Buffer.from('0123456789abcdef').toString('base64')
    const key = Buffer.from('0123456789abcdef').toString('base64')
    const stored = `scrypt$999999999$8$1$${salt}$${key}`
    expect(await verifyPassword('x', stored)).toBe(false)
  })

  it('returns false for a non-string stored value', async () => {
    expect(await verifyPassword('x', null as unknown as string)).toBe(false)
    expect(await verifyPassword('x', undefined as unknown as string)).toBe(false)
  })

  it('does not hang on a very long password', async () => {
    const longPassword = 'a'.repeat(100_000)
    const hash = await hashPassword(longPassword)
    expect(await verifyPassword(longPassword, hash)).toBe(true)
  })

  it('rejects a stored hash whose key length does not match what hashPassword produces', async () => {
    const hash = await hashPassword('whatever')
    const parts = hash.split('$')
    // Replace the key field with a 1-byte key, keeping everything else —
    // including the real cost/block/parallelism parameters — valid, so this
    // exercises the key-length check specifically rather than any of the
    // earlier malformed-input checks.
    const tamperedKey = Buffer.from([0x42]).toString('base64')
    const tampered = [...parts.slice(0, 5), tamperedKey].join('$')
    expect(await verifyPassword('whatever', tampered)).toBe(false)
  })
})
