import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildXrayQuery, resultToCandidate, pickProvider, MISSING_KEYS_MESSAGE, linkedinXraySource } from '@/lib/sources/linkedinXray'
import { getSource } from '@/lib/sources'
import { unsupportedFieldsFor } from '@/lib/scoring/sourceSupport'

describe('buildXrayQuery', () => {
  it('uses the first title, first location, up to 3 skills and exclusions', () => {
    expect(
      buildXrayQuery({
        titles: ['Data Engineer', 'Analytics Engineer'],
        location: ['Cairo'],
        mustHave: ['Python', 'SQL', 'Spark', 'dbt'],
        exclude: ['Intern'],
      }),
    ).toBe('site:linkedin.com/in "Data Engineer" "Cairo" "Python" "SQL" "Spark" -"Intern"')
  })
  it('works with no filters', () => {
    expect(buildXrayQuery({})).toBe('site:linkedin.com/in')
  })
})

describe('resultToCandidate', () => {
  it('parses name, headline and location from a search result', () => {
    const c = resultToCandidate(
      'https://eg.linkedin.com/in/Jane-Doe-123',
      '\u200eJane Doe - Senior Data Engineer - Acme Corp | LinkedIn',
      'Cairo, Egypt · Senior Data Engineer · Acme Corp. 500+ connections.',
    )
    expect(c).toMatchObject({
      fullName: 'Jane Doe',
      profileUrl: 'https://www.linkedin.com/in/jane-doe-123',
      currentTitle: 'Senior Data Engineer',
      location: 'Cairo, Egypt',
    })
  })
  it('does not mistake a job title for a location or skills for a company', () => {
    const c = resultToCandidate(
      'https://eg.linkedin.com/in/x',
      'Mahmoud G - Senior Android Engineer | Kotlin, Jetpack Compose | LinkedIn',
      'Senior Android Engineer · Experience: Vodafone · Education: Cairo University · Location: Cairo, Egypt',
    )
    expect(c?.currentTitle).toBe('Senior Android Engineer')
    expect(c?.currentCompany).toBe('Vodafone')
    expect(c?.location).toBe('Cairo, Egypt')
  })
  it('ignores non-profile results', () => {
    expect(resultToCandidate('https://www.linkedin.com/company/acme', 'Acme | LinkedIn', '')).toBeNull()
  })
})

describe('linkedin-xray source', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is registered and declares skills as unsupported so scoring does not gate on them', () => {
    expect(getSource('linkedin-xray')).toBe(linkedinXraySource)
    expect(unsupportedFieldsFor('linkedin-xray').has('skills')).toBe(true)
  })

  it('fails with a clear message when no provider key is set', async () => {
    for (const k of ['SERPER_API_KEY', 'SERPAPI_KEY', 'GOOGLE_API_KEY', 'GOOGLE_CSE_ID']) vi.stubEnv(k, '')
    await expect(linkedinXraySource.search({ titles: ['x'] })).rejects.toThrow(MISSING_KEYS_MESSAGE)
    vi.unstubAllEnvs()
  })

  it('pages through Serper results, dedups, and respects the limit', async () => {
    for (const k of ['SERPAPI_KEY', 'GOOGLE_API_KEY', 'GOOGLE_CSE_ID']) vi.stubEnv(k, '')
    vi.stubEnv('SERPER_API_KEY', 'k')
    const mk = (n: number) => ({
      link: `https://www.linkedin.com/in/p${n}`,
      title: `Person ${n} - Data Engineer - Co | LinkedIn`,
      snippet: '',
    })
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const page = JSON.parse(String(init?.body)).page as number
      return new Response(JSON.stringify({ organic: Array.from({ length: 10 }, (_, i) => mk(page * 10 + i)) }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const out = await linkedinXraySource.search({ titles: ['Data Engineer'], limit: 15 })
    expect(out).toHaveLength(15)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.unstubAllEnvs()
  })

  it('reads SerpApi organic_results', async () => {
    for (const k of ['SERPER_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_CSE_ID']) vi.stubEnv(k, '')
    vi.stubEnv('SERPAPI_KEY', 'k')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ organic_results: [{ link: 'https://www.linkedin.com/in/a', title: 'A B - Dev | LinkedIn', snippet: '' }] }),
        ),
      ),
    )
    const out = await linkedinXraySource.search({ titles: ['Dev'], limit: 5 })
    expect(out.map((c) => c.fullName)).toEqual(['A B'])
    vi.unstubAllEnvs()
  })

  it('turns a rejected key into a readable error', async () => {
    vi.stubEnv('SERPER_API_KEY', 'bad')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 403 })))
    await expect(linkedinXraySource.search({ titles: ['x'] })).rejects.toThrow(/serper search failed: key rejected/)
    vi.unstubAllEnvs()
  })
})

describe('pickProvider', () => {
  it('prefers serper, then serpapi, then google', () => {
    expect(pickProvider({ SERPER_API_KEY: 'a', SERPAPI_KEY: 'b' })).toBe('serper')
    expect(pickProvider({ SERPAPI_KEY: 'b' })).toBe('serpapi')
    expect(pickProvider({ GOOGLE_API_KEY: 'g', GOOGLE_CSE_ID: 'c' })).toBe('google')
    expect(pickProvider({ GOOGLE_API_KEY: 'g' })).toBeNull()
  })
})

import { detectSkills, inferLocation } from '@/lib/sources/linkedinXray'

describe('x-ray enhancements', () => {
  it('reads the company from a "Title at Company" snippet and drops truncated names', () => {
    const c = resultToCandidate(
      'https://www.linkedin.com/in/a',
      'Youssef Essam - Senior Android Software Engineer at ...',
      'Senior Android Software Engineer at InnovationTeam · I\'m a Senior Android Engineer. Egypt.',
    )
    expect(c?.currentCompany).toBe('InnovationTeam')
    const t = resultToCandidate('https://www.linkedin.com/in/b', 'Sam Roe - Android Dev at ...', '')
    expect(t?.currentCompany).toBeUndefined()
  })

  it('infers the location from the searched place when the result names it', () => {
    expect(inferLocation('Android Kotlin Mentor. Cairo, Egypt. Udacity', 'Egypt')).toBe('Cairo, Egypt')
    expect(inferLocation('Worked in Dubai', 'Egypt')).toBeUndefined()
    const c = resultToCandidate(
      'https://www.linkedin.com/in/h',
      'Hussein El Feky - Senior Android Software Engineer at Meta',
      'Senior Android Software Engineer at Meta · 2M+ installs ... Cairo, Egypt. Android Kotlin Mentor.',
      { location: 'Egypt' },
    )
    expect(c?.location).toBe('Cairo, Egypt')
  })

  it('detects known skills in the text, never from short words, and marks the list partial', () => {
    expect(detectSkills('Android Kotlin Mentor, uses Docker and AWS. We go far.')).toEqual(
      expect.arrayContaining(['Kotlin', 'Docker', 'AWS']),
    )
    expect(detectSkills('We go far')).not.toContain('Go')
    const c = resultToCandidate('https://www.linkedin.com/in/k', 'K L - Dev | Kotlin | LinkedIn', 'Kotlin and Docker')
    expect(c?.skills).toEqual(expect.arrayContaining(['Kotlin', 'Docker']))
    expect(c?.skillsComplete).toBe(false)
  })

  it('searches each title variant in turn and merges without duplicates', async () => {
    vi.stubEnv('SERPER_API_KEY', 'k')
    const queries: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init?: RequestInit) => {
        const { q, page } = JSON.parse(String(init?.body))
        queries.push(q)
        const tag = q.includes('Kotlin') ? 'k' : 'a'
        return new Response(
          JSON.stringify({
            organic: Array.from({ length: 10 }, (_, i) => ({
              link: `https://www.linkedin.com/in/${tag}${page * 10 + i}`,
              title: `P ${tag}${i} - Dev | LinkedIn`,
              snippet: '',
            })),
          }),
        )
      }),
    )
    const out = await linkedinXraySource.search({ titles: ['Android Engineer', 'Kotlin Developer'], limit: 30 })
    expect(out).toHaveLength(30)
    expect(queries[0]).toContain('Android Engineer')
    expect(queries[1]).toContain('Kotlin Developer')
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
})

describe('inferLocation case handling', () => {
  it('does not pull ordinary words into the city', () => {
    expect(inferLocation('in Computer and Information from Cairo, Egypt', 'Egypt')).toBe('Cairo, Egypt')
    expect(inferLocation('studied in egypt', 'Egypt')).toBe('egypt')
  })
})

import { portalProfileUrl, portalResultToCandidate, selectedPortals } from '@/lib/sources/linkedinXray'

describe('portals', () => {
  it('defaults to LinkedIn and ignores unknown portal ids', () => {
    expect(selectedPortals(undefined)).toEqual(['linkedin'])
    expect(selectedPortals(['bayt', 'indeed', 'bayt', 'xing'])).toEqual(['bayt', 'xing'])
    expect(selectedPortals(['indeed'])).toEqual(['linkedin'])
  })

  it('accepts only real profile pages', () => {
    expect(portalProfileUrl('bayt', 'https://people.bayt.com/profile-profile-45857958/')).toBe(
      'https://people.bayt.com/profile-profile-45857958/',
    )
    expect(portalProfileUrl('bayt', 'https://www.bayt.com/en/egypt/jobs/android-developer-jobs/')).toBeNull()
    expect(portalProfileUrl('stackoverflow', 'https://stackoverflow.com/users/4843993/hussein-el-feky')).toBe(
      'https://stackoverflow.com/users/4843993/hussein-el-feky',
    )
    expect(portalProfileUrl('stackoverflow', 'https://stackoverflow.com/users/story/4843993?embed=sidebar')).toBeNull()
    expect(portalProfileUrl('behance', 'https://www.behance.net/amrkamal-7')).toBe('https://www.behance.net/amrkamal-7')
    expect(portalProfileUrl('behance', 'https://www.behance.net/gallery/123/foo')).toBeNull()
    expect(portalProfileUrl('xing', 'https://www.xing.com/profile/mohamed_khaled43')).toBe(
      'https://www.xing.com/profile/mohamed_khaled43',
    )
  })

  it('maps portal results to candidates', () => {
    const x = portalResultToCandidate(
      'xing',
      'https://www.xing.com/profile/mohamed_khaled43',
      'mohamed khaled - Android Software Engineer - Telecom Egypt | XING',
      'Kotlin developer based in Cairo, Egypt.',
      { location: 'Egypt' },
    )
    expect(x).toMatchObject({
      fullName: 'mohamed khaled',
      currentTitle: 'Android Software Engineer',
      currentCompany: 'Telecom Egypt',
      location: 'Cairo, Egypt',
      skillsComplete: false,
    })
    expect(x?.skills).toContain('Kotlin')
    const so = portalResultToCandidate('stackoverflow', 'https://stackoverflow.com/users/4843993/hussein-el-feky', 'User Hussein El Feky', '')
    expect(so?.fullName).toBe('Hussein El Feky')
    const b = portalResultToCandidate('bayt', 'https://people.bayt.com/profile-profile-1/', 'Andrew Gabra - SOFTWARE ENGINEER Android Developer', '')
    expect(b).toMatchObject({ fullName: 'Andrew Gabra', currentTitle: 'SOFTWARE ENGINEER Android Developer' })
  })

  it('searches every selected portal with its own site: filter', async () => {
    vi.stubEnv('SERPER_API_KEY', 'k')
    const queries: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init?: RequestInit) => {
        queries.push(JSON.parse(String(init?.body)).q)
        return new Response(JSON.stringify({ organic: [] }))
      }),
    )
    await linkedinXraySource.search({ titles: ['Android Developer'], portals: ['linkedin', 'bayt'], limit: 10 })
    expect(queries.some((q) => q.startsWith('site:linkedin.com/in'))).toBe(true)
    expect(queries.some((q) => q.startsWith('site:people.bayt.com/profile'))).toBe(true)
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
})

describe('location guess ignores the person\'s own name', () => {
  it('does not fold name words into the city', () => {
    const c = portalResultToCandidate(
      'stackoverflow',
      'https://stackoverflow.com/users/1/hussein-el-feky',
      'User Hussein El Feky',
      'Hussein El Feky Cairo, Egypt',
      { location: 'Egypt' },
    )
    expect(c?.location).toBe('Cairo, Egypt')
  })
})
