import { describe, expect, it } from 'vitest'
import { PUBLIC_PATHS, ROLES, STAGES } from '@/lib/auth/constants'

describe('auth constants', () => {
  it('freezes ROLES so it cannot be mutated by an importer', () => {
    expect(Object.isFrozen(ROLES)).toBe(true)
    expect(() => {
      // @ts-expect-error intentionally violating the readonly type at runtime
      ROLES.ADMIN = 'HACKED'
    }).toThrow()
    expect(ROLES.ADMIN).toBe('ADMIN')
  })

  it('freezes STAGES so it cannot be mutated by an importer', () => {
    expect(Object.isFrozen(STAGES)).toBe(true)
    expect(() => {
      // @ts-expect-error intentionally violating the readonly type at runtime
      STAGES.push('Extra')
    }).toThrow()
    expect(STAGES).toHaveLength(7)
  })

  it('freezes PUBLIC_PATHS so it cannot be mutated by an importer', () => {
    expect(Object.isFrozen(PUBLIC_PATHS)).toBe(true)
    expect(() => {
      // @ts-expect-error intentionally violating the readonly type at runtime
      PUBLIC_PATHS.push('/anything')
    }).toThrow()
    expect(PUBLIC_PATHS).toEqual(['/login', '/api/auth/login'])
  })
})
