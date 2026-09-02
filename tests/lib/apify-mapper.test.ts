import { describe, expect, it } from 'vitest'
import { mapToCandidate } from '@/lib/apify'

const RAW = {
  id: 'abc',
  fullName: 'Layla Nasser',
  headline: 'Platform engineer',
  currentJobTitle: 'Platform Engineer',
  currentCompany: 'CloudCo',
  location: 'Riyadh, Saudi Arabia',
  profileUrl: 'https://linkedin.com/in/laylanasser',
  industry: 'Computer Software',
  about: 'Platform work',
  skills: ['Kubernetes', { name: 'Terraform' }],
  experience: [{ title: 'Platform Engineer', company: 'CloudCo', durationMonths: 30 }],
  education: [{ school: 'KSU', degreeName: 'BSc', fieldOfStudy: 'Computer Engineering' }],
  languages: [{ name: 'Arabic', proficiency: 'Native or bilingual proficiency' }],
  certifications: ['CKA'],
}

describe('mapToCandidate', () => {
  it('keeps the field of study', () => {
    expect(mapToCandidate(RAW).education[0].field).toBe('Computer Engineering')
  })

  it('keeps the language proficiency', () => {
    expect(mapToCandidate(RAW).languages).toEqual([
      { name: 'Arabic', proficiency: 'Native or bilingual proficiency' },
    ])
  })

  it('keeps the industry', () => {
    expect(mapToCandidate(RAW).industry).toBe('Computer Software')
  })

  it('keeps the certifications', () => {
    expect(mapToCandidate(RAW).certifications).toEqual(['CKA'])
  })

  it('still maps the fields it already handled', () => {
    const candidate = mapToCandidate(RAW)
    expect(candidate.fullName).toBe('Layla Nasser')
    expect(candidate.currentTitle).toBe('Platform Engineer')
    expect(candidate.skills).toEqual(['Kubernetes', 'Terraform'])
  })

  it('never throws on an empty object', () => {
    expect(() => mapToCandidate({})).not.toThrow()
    const candidate = mapToCandidate({})
    expect(candidate.skills).toEqual([])
    expect(candidate.experience).toEqual([])
    expect(candidate.education).toEqual([])
    expect(candidate.certifications).toEqual([])
  })

  it('never throws when array-shaped fields are null, a number, a string, or an object instead of an array', () => {
    const badValues = [null, 42, 'oops', { not: 'an array' }]
    for (const bad of badValues) {
      const rawItem = {
        ...RAW,
        skills: bad,
        experience: bad,
        education: bad,
        languages: bad,
        certifications: bad,
      }
      expect(() => mapToCandidate(rawItem)).not.toThrow()
      const candidate = mapToCandidate(rawItem)
      expect(candidate.skills).toEqual([])
      expect(candidate.experience).toEqual([])
      expect(candidate.education).toEqual([])
      expect(candidate.languages).toEqual([])
      expect(candidate.certifications).toEqual([])
    }
  })

  it('coerces a non-array languages into an empty array, same as its four siblings', () => {
    const badValues = [null, 42, 'oops', { not: 'an array' }]
    for (const bad of badValues) {
      expect(mapToCandidate({ ...RAW, languages: bad }).languages).toEqual([])
    }
  })

  it('never throws on a null element inside an otherwise valid array', () => {
    const rawItem = {
      ...RAW,
      skills: [null, 'Go'],
      experience: [null, { title: 'Eng', company: 'Acme' }],
      education: [null, { school: 'MIT' }],
      certifications: [null, 'CKA'],
    }
    expect(() => mapToCandidate(rawItem)).not.toThrow()
    const candidate = mapToCandidate(rawItem)
    expect(candidate.skills).toEqual(['Go'])
    expect(candidate.experience[0]).toEqual({ title: undefined, company: undefined, durationMonths: undefined, from: undefined, to: undefined })
    expect(candidate.experience[1].title).toBe('Eng')
    expect(candidate.education[1].school).toBe('MIT')
    expect(candidate.certifications).toEqual(['CKA'])
  })

  it('does not emit undefined entries for skills or certifications objects missing a name', () => {
    const rawItem = {
      ...RAW,
      skills: ['Go', { name: 'Rust' }, {}],
      certifications: ['CKA', {}, { name: 'PMP' }],
    }
    const candidate = mapToCandidate(rawItem)
    expect(candidate.skills).toEqual(['Go', 'Rust'])
    expect(candidate.certifications).toEqual(['CKA', 'PMP'])
  })
})
