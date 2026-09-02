import { describe, expect, it } from 'vitest'
import { normalizeEducation, type EducationEntry } from '@/lib/normalize/education'

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

  it('does not emit a bare degree-name fragment as a field of study', () => {
    expect(normalizeEducation([{ school: 'S', degree: 'Master of Science' }]).fieldsOfStudy).toEqual([])
    expect(normalizeEducation([{ school: 'S', degree: 'High School Certificate' }]).fieldsOfStudy).toEqual([])
    expect(normalizeEducation([{ school: 'S', degree: 'Higher Diploma' }]).fieldsOfStudy).toEqual([])
    expect(normalizeEducation([{ school: 'S', degree: 'Thanaweya Amma' }]).fieldsOfStudy).toEqual([])
  })

  it('still parses multi-word fields correctly for Bachelor, Master and Doctorate degrees', () => {
    expect(normalizeEducation([{ school: 'S', degree: 'MSc Data Science' }]).fieldsOfStudy).toEqual([
      'Data Science',
    ])
    expect(normalizeEducation([{ school: 'S', degree: 'B.S. Computer Science' }]).fieldsOfStudy).toEqual([
      'Computer Science',
    ])
  })

  it('never filters an explicit field, even if it matches a stop word', () => {
    expect(
      normalizeEducation([{ school: 'S', degree: 'Master of Science', field: 'Science' }]).fieldsOfStudy,
    ).toEqual(['Science'])
  })

  it('treats non-string degree, school and field values as absent rather than throwing', () => {
    expect(
      normalizeEducation([{ school: 42 as unknown as string, degree: {} as unknown as string, field: [] as unknown as string }]),
    ).toEqual({ highestDegree: null, fieldsOfStudy: [], schools: [] })
  })

  it('skips a null or non-object element rather than throwing, and keeps the rest', () => {
    const validEntry = { school: 'X', degree: 'BSc Physics' }
    const expected = { highestDegree: 'Bachelor', fieldsOfStudy: ['Physics'], schools: ['X'] }
    expect(normalizeEducation([null as unknown as EducationEntry, validEntry])).toEqual(expected)
    expect(normalizeEducation([undefined as unknown as EducationEntry, validEntry])).toEqual(expected)
  })

  it('returns the empty-result shape rather than throwing when every element is junk', () => {
    expect(
      normalizeEducation([
        null as unknown as EducationEntry,
        42 as unknown as EducationEntry,
        'text' as unknown as EducationEntry,
        [] as unknown as EducationEntry,
      ]),
    ).toEqual({ highestDegree: null, fieldsOfStudy: [], schools: [] })
  })

  it('de-duplicates fields of study case-insensitively, keeping the first-seen casing', () => {
    expect(
      normalizeEducation([
        { school: 'A', degree: 'BSc', field: 'Computer Science' },
        { school: 'B', degree: 'MSc', field: 'computer science' },
      ]).fieldsOfStudy,
    ).toEqual(['Computer Science'])
  })

  it('de-duplicates schools case-insensitively, keeping the first-seen casing', () => {
    expect(
      normalizeEducation([
        { school: 'MIT', degree: 'BSc' },
        { school: 'mit', degree: 'MSc' },
      ]).schools,
    ).toEqual(['MIT'])
  })
})
