import { describe, expect, it } from 'vitest'
import {
  buildGithubUserQuery,
  parseSearchHits,
  mapGithubUserToCandidate,
  applyExcludeFilter,
  formatRateLimitError,
  KNOWN_LANGUAGES,
} from '@/lib/sources/github'
import { githubSource } from '@/lib/sources/github'
import { getSource, listSources } from '@/lib/sources'

describe('buildGithubUserQuery', () => {
  it('always includes type:user', () => {
    expect(buildGithubUserQuery({})).toBe('type:user')
  })

  it('maps a recognised programming language skill to a language: qualifier', () => {
    const q = buildGithubUserQuery({ mustHave: ['Python'] })
    expect(q).toBe('type:user language:python')
  })

  it('maps an unrecognised skill/title to a free-text term', () => {
    const q = buildGithubUserQuery({ titles: ['Backend Engineer'] })
    expect(q).toBe('type:user "Backend Engineer"')
  })

  it('maps location to a location: qualifier, using only the first location', () => {
    const q = buildGithubUserQuery({ location: ['Cairo, Egypt', 'Berlin'] })
    expect(q).toBe('type:user location:"Cairo, Egypt"')
  })

  it('combines free text, language, and location qualifiers', () => {
    const q = buildGithubUserQuery({
      titles: ['Engineer'],
      mustHave: ['Go'],
      location: ['Remote'],
    })
    expect(q).toBe('type:user Engineer language:go location:Remote')
  })

  it('never throws on malformed filter values', () => {
    expect(() =>
      buildGithubUserQuery({
        titles: [null as unknown as string, '', '  '],
        mustHave: undefined,
        location: [42 as unknown as string],
      }),
    ).not.toThrow()
  })

  it('recognises golang, c++ and c# as language aliases', () => {
    expect(buildGithubUserQuery({ mustHave: ['golang'] })).toContain('language:go')
    expect(buildGithubUserQuery({ mustHave: ['c++'] })).toContain('language:c++')
    expect(buildGithubUserQuery({ mustHave: ['c#'] })).toContain('language:c#')
  })

  it('KNOWN_LANGUAGES contains common engineering languages', () => {
    expect(KNOWN_LANGUAGES.has('python')).toBe(true)
    expect(KNOWN_LANGUAGES.has('typescript')).toBe(true)
  })
})

describe('parseSearchHits', () => {
  it('extracts logins from a well-formed response', () => {
    const body = { items: [{ login: 'alice' }, { login: 'bob' }] }
    expect(parseSearchHits(body)).toEqual([{ login: 'alice' }, { login: 'bob' }])
  })

  it('returns an empty array for a non-object body', () => {
    expect(parseSearchHits(null)).toEqual([])
    expect(parseSearchHits(undefined)).toEqual([])
    expect(parseSearchHits('oops')).toEqual([])
    expect(parseSearchHits(42)).toEqual([])
  })

  it('returns an empty array when items is missing or not an array', () => {
    expect(parseSearchHits({})).toEqual([])
    expect(parseSearchHits({ items: 'oops' })).toEqual([])
    expect(parseSearchHits({ items: null })).toEqual([])
  })

  it('skips non-object elements and elements without a usable login', () => {
    const body = { items: [null, 42, {}, { login: 123 }, { login: '' }, { login: 'valid' }] }
    expect(parseSearchHits(body)).toEqual([{ login: 'valid' }])
  })
})

describe('mapGithubUserToCandidate', () => {
  const RAW_USER = {
    login: 'khaledhosny',
    id: 93914,
    name: 'Khaled Hosny',
    company: '@Alif-Type',
    location: 'Cairo',
    bio: 'Type designer and software developer from Egypt.',
    avatar_url: 'https://avatars.githubusercontent.com/u/93914?v=4',
    html_url: 'https://github.com/khaledhosny',
    followers: 733,
  }

  it('maps a well-formed user to a Candidate', () => {
    const candidate = mapGithubUserToCandidate(RAW_USER)!
    expect(candidate.fullName).toBe('Khaled Hosny')
    expect(candidate.currentCompany).toBe('Alif-Type') // leading @ stripped
    expect(candidate.location).toBe('Cairo')
    expect(candidate.profileUrl).toBe('https://github.com/khaledhosny')
    expect(candidate.headline).toBe(RAW_USER.bio)
    expect(candidate.totalYearsExperience).toBeUndefined() // never fabricated
  })

  it('declares unsupported fields as empty/absent rather than guessed', () => {
    const candidate = mapGithubUserToCandidate(RAW_USER)!
    expect(candidate.skills).toEqual([])
    expect(candidate.experience).toEqual([])
    expect(candidate.education).toEqual([])
    expect(candidate.currentTitle).toBeUndefined()
    expect(candidate.industry).toBeUndefined()
  })

  it('falls back to login when name is absent', () => {
    const candidate = mapGithubUserToCandidate({ login: 'noname', html_url: 'https://github.com/noname' })!
    expect(candidate.fullName).toBe('noname')
  })

  it('returns null for a non-object or a user with neither login nor html_url', () => {
    expect(mapGithubUserToCandidate(null)).toBeNull()
    expect(mapGithubUserToCandidate(42)).toBeNull()
    expect(mapGithubUserToCandidate({})).toBeNull()
  })

  it('never throws on malformed field types', () => {
    const bad = { login: 'x', name: 42, bio: {}, company: [], location: null, avatar_url: 99 }
    expect(() => mapGithubUserToCandidate(bad)).not.toThrow()
  })
})

describe('applyExcludeFilter', () => {
  const candidates = [
    mapGithubUserToCandidate({ login: 'a', html_url: 'https://github.com/a', bio: 'I love recruiting spam' })!,
    mapGithubUserToCandidate({ login: 'b', html_url: 'https://github.com/b', bio: 'Backend engineer' })!,
  ]

  it('filters candidates whose text matches an excluded keyword', () => {
    const result = applyExcludeFilter(candidates, ['spam'])
    expect(result.map((c) => c.externalId)).toEqual(['b'])
  })

  it('returns candidates unchanged when there are no excluded terms', () => {
    expect(applyExcludeFilter(candidates, [])).toBe(candidates)
  })
})

describe('formatRateLimitError', () => {
  it('includes the resource name and a formatted reset time', () => {
    const message = formatRateLimitError('search', '1788771877')
    expect(message).toContain('"search"')
    expect(message).toContain('2026-')
    expect(message).toContain('GITHUB_TOKEN')
  })

  it('degrades gracefully when the reset header is missing or malformed', () => {
    expect(formatRateLimitError('core', null)).toContain('unknown time')
    expect(formatRateLimitError('core', 'not-a-number')).toContain('unknown time')
  })
})

describe('source registry', () => {
  it('registers github and only github', () => {
    expect(getSource('github')).toBe(githubSource)
    expect(listSources().map((s) => s.id)).toEqual(['github'])
  })

  it('throws a clear error for an unknown source id', () => {
    expect(() => getSource('linkedin')).toThrow(/Unknown candidate source "linkedin"/)
  })
})
