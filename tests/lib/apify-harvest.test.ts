import { describe, expect, it } from 'vitest'
import { seniorityIds, yearsOfExperienceIds, apiActorId, buildActorInput, mapToCandidate, parseDurationMonths, APIFY_MAX_ITEMS } from '@/lib/apify'

// Shape taken from a real harvestapi/linkedin-profile-search "Full" run.
const ITEM = {
  id: 'ACoAACHBYtYBJnOe8',
  publicIdentifier: 'mgelgazar',
  linkedinUrl: 'https://www.linkedin.com/in/mgelgazar',
  firstName: 'Mahmoud',
  lastName: 'Elgazzar',
  headline: 'Experienced Sitecore & .NET Developer',
  about: 'Backend engineer',
  location: { linkedinText: 'Cairo, Egypt', parsed: { text: 'Cairo, Egypt' } },
  industry: { id: 96, name: 'IT Services and IT Consulting' },
  photo: 'https://media.licdn.com/photo.jpg',
  topSkills: ['C#'],
  skills: [{ name: 'Sitecore', positions: ['x'] }, { name: 'C#' }],
  currentPosition: [{ position: 'Senior Software Engineer', companyName: 'Significa' }],
  experience: [
    {
      position: 'Senior Software Engineer',
      companyName: 'Significa',
      duration: '2 yrs 3 mos',
      startDate: { month: 'Aug', year: 2024, text: 'Aug 2024' },
      endDate: { text: 'Present' },
    },
  ],
  education: [
    { schoolName: 'Ain Shams University', degree: "Bachelor's degree", fieldOfStudy: 'Computer Science', endDate: { year: 2020, text: '2020' } },
  ],
  certifications: [{ title: 'Docker', issuedBy: 'LinkedIn' }],
  languages: [{ name: 'Arabic', proficiency: 'Native or bilingual proficiency' }],
}

describe('mapToCandidate (harvestapi full-mode item)', () => {
  const c = mapToCandidate(ITEM)

  it('maps identity and current job', () => {
    expect(c.externalId).toBe('ACoAACHBYtYBJnOe8')
    expect(c.fullName).toBe('Mahmoud Elgazzar')
    expect(c.profileUrl).toBe('https://www.linkedin.com/in/mgelgazar')
    expect(c.currentTitle).toBe('Senior Software Engineer')
    expect(c.currentCompany).toBe('Significa')
    expect(c.location).toBe('Cairo, Egypt')
    expect(c.industry).toBe('IT Services and IT Consulting')
    expect(c.avatarUrl).toBe('https://media.licdn.com/photo.jpg')
  })

  it('merges skills and de-duplicates them', () => {
    expect(c.skills).toEqual(['Sitecore', 'C#'])
  })

  it('maps experience, education and certifications', () => {
    expect(c.experience[0]).toMatchObject({ title: 'Senior Software Engineer', company: 'Significa', durationMonths: 27, from: 'Aug 2024', to: 'Present' })
    expect(c.education[0]).toMatchObject({ school: 'Ain Shams University', field: 'Computer Science', year: '2020' })
    expect(c.certifications).toEqual(['Docker'])
  })
})

describe('parseDurationMonths', () => {
  it('reads years and months', () => {
    expect(parseDurationMonths('2 yrs 3 mos')).toBe(27)
    expect(parseDurationMonths('1 yr')).toBe(12)
    expect(parseDurationMonths('8 mos')).toBe(8)
    expect(parseDurationMonths('soon')).toBeUndefined()
    expect(parseDurationMonths(null)).toBeUndefined()
  })
})

describe('buildActorInput', () => {
  it('sends title and location with Full mode', () => {
    expect(buildActorInput({ titles: ['Backend Engineer', 'Developer'], location: ['Cairo'], limit: 10 })).toEqual({
      profileScraperMode: 'Full',
      maxItems: 10,
      searchQuery: '("Backend Engineer" OR Developer)',
      locations: ['Cairo'],
    })
  })

  it('caps maxItems so a run cannot overspend', () => {
    expect(buildActorInput({ titles: ['x'], limit: 5000 }).maxItems).toBe(APIFY_MAX_ITEMS)
    expect(buildActorInput({ titles: ['x'] }).maxItems).toBe(25)
  })
})

describe('apiActorId', () => {
  it('converts the Store form to the API form', () => {
    expect(apiActorId('harvestapi/linkedin-profile-search')).toBe('harvestapi~linkedin-profile-search')
    expect(apiActorId('harvestapi~linkedin-profile-search')).toBe('harvestapi~linkedin-profile-search')
  })
})

describe('extra actor-side filters', () => {
  it('adds up to 3 must-have skills as AND keywords', () => {
    expect(
      buildActorInput({ titles: ['Backend Engineer'], mustHave: ['Go', 'Kubernetes', 'AWS Lambda', 'Redis'] }).searchQuery,
    ).toBe('"Backend Engineer" AND Go AND Kubernetes AND "AWS Lambda"')
  })

  it('maps seniority only when every level has a LinkedIn equivalent', () => {
    expect(seniorityIds(['Senior', 'Director'])).toEqual(['120', '220'])
    expect(seniorityIds(['Senior', 'Mid'])).toBeUndefined()
    expect(seniorityIds([])).toBeUndefined()
  })

  it('maps a years range to overlapping LinkedIn buckets and ignores the default range', () => {
    expect(yearsOfExperienceIds(0, 20)).toBeUndefined()
    expect(yearsOfExperienceIds(3, 8)).toEqual(['3', '4'])
    expect(yearsOfExperienceIds(10, 20)).toEqual(['4', '5'])
    expect(yearsOfExperienceIds(0, 2)).toEqual(['1', '2'])
  })

  it('sends excluded keywords as excluded titles, plus seniority and years', () => {
    expect(
      buildActorInput({ titles: ['Dev'], seniority: ['Senior'], yearsMin: 3, yearsMax: 10, exclude: ['Intern'] }),
    ).toMatchObject({ seniorityLevelIds: ['120'], yearsOfExperienceIds: ['3', '4'], excludeCurrentJobTitles: ['Intern'] })
  })
})

import { buildMemo23Input, configuredActorIds, mapMemo23ToCandidate, parseDateRange } from '@/lib/apify'

// Shape taken from a real memo23/linkedin-people-search "public" run.
const MEMO = {
  name: 'Abanob Kamal',
  jobTitle: 'Software Development Engineer II',
  location: 'Cairo, Egypt',
  profileUrl: 'https://www.linkedin.com/in/abanob-kamal-196859215',
  summary: 'SDE 2 @ Noon | Ex Luciq',
  currentCompany: 'noon',
  about: 'Backend engineer',
  imageUrl: 'https://media.licdn.com/p.jpg',
  topSkills: ['Problem Solving', 'Programming Languages'],
  languages: [],
  experience: [
    { title: 'SDE II', company: 'noon', date: 'Apr 2025 - Oct 2025', isCurrent: false },
    { title: 'SDE I', company: 'noon', date: 'Oct 2024 - Apr 2025', isCurrent: false },
  ],
  education: [{ school: 'GUC', degree: 'BSc, Computer Science', date: 'Oct 2019 - Jun 2024' }],
}

describe('configuredActorIds', () => {
  it('splits a comma list and accepts either id form', () => {
    expect(configuredActorIds('harvestapi/linkedin-profile-search, memo23~linkedin-people-search')).toEqual([
      'harvestapi/linkedin-profile-search',
      'memo23/linkedin-people-search',
    ])
    expect(configuredActorIds(undefined)).toEqual([])
  })
})

describe('memo23 mapping', () => {
  it('builds a cookie-free public search input', () => {
    expect(buildMemo23Input({ titles: ['Backend Engineer', 'Developer'], location: ['Cairo'], seniority: ['Junior'], limit: 20 })).toEqual({
      mode: 'public',
      maxResults: 20,
      keywords: 'Backend Engineer Cairo',
      title: 'Backend Engineer',
      queries: ['Developer Cairo'],
      location: 'Cairo',
      seniorityLevels: ['Entry'],
    })
    expect(buildMemo23Input({ titles: ['x'], seniority: ['Mid'] })).not.toHaveProperty('seniorityLevels')
  })

  it('parses date ranges into months', () => {
    expect(parseDateRange('Oct 2024 - Apr 2025')).toMatchObject({ from: 'Oct 2024', to: 'Apr 2025', months: 6 })
    expect(parseDateRange('2019 - 2024').months).toBe(60)
    expect(parseDateRange(undefined)).toEqual({})
  })

  it('maps a real item to a candidate', () => {
    const c = mapMemo23ToCandidate(MEMO)
    expect(c).toMatchObject({
      externalId: MEMO.profileUrl,
      fullName: 'Abanob Kamal',
      currentTitle: 'Software Development Engineer II',
      currentCompany: 'noon',
      location: 'Cairo, Egypt',
      skills: ['Problem Solving', 'Programming Languages'],
      totalYearsExperience: 1,
    })
    expect(c.education[0]).toMatchObject({ school: 'GUC', year: '2024' })
    expect(() => mapMemo23ToCandidate({})).not.toThrow()
  })
})

import { applyGates } from '@/lib/scoring/gates'

describe('must-have skills with a partial skills list', () => {
  it('does not gate a candidate whose skills list is only partial', () => {
    const c = mapMemo23ToCandidate(MEMO)
    expect(applyGates(c, { mustHave: ['Kotlin'] }, 'apify').passed).toBe(true)
  })

  it('still gates when the skills list is complete', () => {
    const c = mapToCandidate(ITEM)
    expect(applyGates(c, { mustHave: ['Kotlin'] }, 'apify').passed).toBe(false)
  })
})
