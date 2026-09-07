import { describe, expect, it } from 'vitest'
import { missingCredentialsMessage } from '@/lib/apify'

describe('missingCredentialsMessage', () => {
  it('names a single missing variable', () => {
    const message = missingCredentialsMessage(['APIFY_TOKEN'])
    expect(message).toContain('APIFY_TOKEN')
    expect(message).not.toContain('APIFY_ACTOR_ID')
    expect(message).toMatch(/^Missing Apify credential: /)
  })

  it('names every missing variable when more than one is absent', () => {
    const message = missingCredentialsMessage(['APIFY_TOKEN', 'APIFY_ACTOR_ID'])
    expect(message).toContain('APIFY_TOKEN')
    expect(message).toContain('APIFY_ACTOR_ID')
    expect(message).toMatch(/^Missing Apify credentials: /)
  })

  it('points at .env and the APIFY_MOCK escape hatch', () => {
    const message = missingCredentialsMessage(['APIFY_TOKEN'])
    expect(message).toMatch(/\.env/)
    expect(message).toMatch(/APIFY_MOCK=true/)
  })
})
