import { describe, expect, it } from 'vitest'
import { resolveRequestedSourceId, APIFY_SOURCE_ID, DEFAULT_SOURCE_ID } from '@/lib/sources'

describe('resolveRequestedSourceId', () => {
  it('defaults to github when no source is given', () => {
    expect(resolveRequestedSourceId(undefined)).toBe('github')
    expect(DEFAULT_SOURCE_ID).toBe('github')
  })

  it('defaults to github for a blank/whitespace-only source', () => {
    expect(resolveRequestedSourceId('')).toBe('github')
    expect(resolveRequestedSourceId('   ')).toBe('github')
  })

  it('defaults to github for a non-string source', () => {
    expect(resolveRequestedSourceId(42)).toBe('github')
    expect(resolveRequestedSourceId(null)).toBe('github')
  })

  it('accepts a registered source id', () => {
    expect(resolveRequestedSourceId('github')).toBe('github')
  })

  it('accepts the apify source id even though it is not in the registry', () => {
    expect(resolveRequestedSourceId('apify')).toBe(APIFY_SOURCE_ID)
  })

  it('rejects an unknown source id with a clear error', () => {
    expect(() => resolveRequestedSourceId('linkedin')).toThrow(/Unknown candidate source "linkedin"/)
  })

  it('trims surrounding whitespace before validating', () => {
    expect(resolveRequestedSourceId('  github  ')).toBe('github')
  })
})
