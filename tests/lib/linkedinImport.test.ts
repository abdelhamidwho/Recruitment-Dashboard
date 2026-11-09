import { describe, expect, it } from 'vitest'
import { canonicalLinkedInUrl, parseLinkedInImport, splitHeadline } from '@/lib/linkedinImport'

describe('canonicalLinkedInUrl', () => {
  it('normalises country subdomains, query strings and case', () => {
    expect(canonicalLinkedInUrl('https://eg.linkedin.com/in/Jane-Doe-123/?trk=x')).toBe(
      'https://www.linkedin.com/in/jane-doe-123',
    )
  })
  it('rejects non-profile URLs', () => {
    expect(canonicalLinkedInUrl('https://www.linkedin.com/company/acme')).toBeNull()
    expect(canonicalLinkedInUrl(42)).toBeNull()
  })
})

describe('splitHeadline', () => {
  it('splits "at", "@" and " - " forms', () => {
    expect(splitHeadline('Data Engineer at Acme | Python')).toEqual({ title: 'Data Engineer', company: 'Acme' })
    expect(splitHeadline('Data Engineer @ Acme')).toEqual({ title: 'Data Engineer', company: 'Acme' })
    expect(splitHeadline('Data Engineer - Acme Corp')).toEqual({ title: 'Data Engineer', company: 'Acme Corp' })
  })
})

describe('parseLinkedInImport', () => {
  it('maps a lead into a Candidate and dedups by canonical URL', () => {
    const { candidates, errors } = parseLinkedInImport([
      { profileUrl: 'https://eg.linkedin.com/in/jane', fullName: 'Jane', headline: 'Data Engineer at Acme' },
      { profileUrl: 'https://www.linkedin.com/in/JANE/', fullName: 'Jane again' },
    ])
    expect(errors).toEqual([])
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      externalId: 'jane',
      currentTitle: 'Data Engineer',
      currentCompany: 'Acme',
      skills: [],
    })
  })

  it('reports items missing a URL or name instead of throwing', () => {
    const { candidates, errors } = parseLinkedInImport([{ fullName: 'No url' }, null, 'x'])
    expect(candidates).toEqual([])
    expect(errors).toHaveLength(3)
  })

  it('prefers captured experience for the current role', () => {
    const { candidates } = parseLinkedInImport({
      profileUrl: 'https://www.linkedin.com/in/a',
      name: 'A',
      headline: 'Whatever',
      experience: [{ title: 'Lead', company: 'Beta', from: 'Jan 2020' }],
    })
    expect(candidates[0].currentTitle).toBe('Lead')
    expect(candidates[0].currentCompany).toBe('Beta')
  })
})

describe('bookmarklet', () => {
  it('is a self-contained function that parses as JavaScript', async () => {
    const { bookmarkletSource, bookmarkletHref } = await import('@/lib/linkedinBookmarklet')
    expect(() => new Function('return (' + bookmarkletSource + ')')).not.toThrow()
    expect(bookmarkletHref().startsWith('javascript:(')).toBe(true)
  })
})
