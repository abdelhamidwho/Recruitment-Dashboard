import { describe, expect, it } from 'vitest'
import { normalizeEducation } from '@/lib/normalize/education'

describe('normalizeEducation', () => {
  it('reads level and field out of a combined degree string', () => {
    expect(normalizeEducation([{ school: 'UC', degree: 'B.S. Computer Science' }])).toEqual({
      highestDegree: 'Bachelor',
      fieldsOfStudy: ['Computer Science'],
      schools: ['UC'],
    })
  })

  it('prefers an explicit field over one parsed from the degree', () => {
    expect(
      normalizeEducation([{ school: 'UC', degree: 'B.S. Computer Science', field: 'Software Engineering' }]),
    ).toEqual({
      highestDegree: 'Bachelor',
      fieldsOfStudy: ['Software Engineering'],
      schools: ['UC'],
    })
  })

  it('keeps the highest degree when several are present', () => {
    expect(
      normalizeEducation([
        { school: 'Cairo University', degree: 'BSc Engineering' },
        { school: 'MIT', degree: 'PhD in Machine Learning' },
      ]).highestDegree,
    ).toBe('Doctorate')
  })

  it('recognises an MBA as distinct from a generic masters', () => {
    expect(normalizeEducation([{ school: 'INSEAD', degree: 'MBA' }]).highestDegree).toBe('MBA')
  })

  it('recognises the common degree spellings', () => {
    const level = (degree: string) => normalizeEducation([{ school: 'S', degree }]).highestDegree
    expect(level('Master of Science')).toBe('Master')
    expect(level('MSc Data Science')).toBe('Master')
    expect(level('Bachelor of Engineering')).toBe('Bachelor')
    expect(level('Higher Diploma')).toBe('Diploma')
    expect(level('High School Certificate')).toBe('High school')
  })

  it('collects distinct fields across entries', () => {
    expect(
      normalizeEducation([
        { school: 'A', degree: 'BSc', field: 'Physics' },
        { school: 'B', degree: 'MSc', field: 'Physics' },
        { school: 'C', degree: 'MSc', field: 'Statistics' },
      ]).fieldsOfStudy,
    ).toEqual(['Physics', 'Statistics'])
  })

  it('returns empty results rather than throwing on missing data', () => {
    expect(normalizeEducation([])).toEqual({ highestDegree: null, fieldsOfStudy: [], schools: [] })
    expect(normalizeEducation(null)).toEqual({ highestDegree: null, fieldsOfStudy: [], schools: [] })
    expect(normalizeEducation([{ school: 'Only a school' }])).toEqual({
      highestDegree: null,
      fieldsOfStudy: [],
      schools: ['Only a school'],
    })
  })
})
