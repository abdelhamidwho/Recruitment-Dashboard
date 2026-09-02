export type DegreeLevel = 'High school' | 'Diploma' | 'Bachelor' | 'Master' | 'MBA' | 'Doctorate'

export interface EducationEntry {
  school?: string
  degree?: string
  field?: string
  year?: string
}

export interface NormalizedEducation {
  highestDegree: DegreeLevel | null
  fieldsOfStudy: string[]
  schools: string[]
}

const RANK: Record<DegreeLevel, number> = {
  'High school': 1,
  Diploma: 2,
  Bachelor: 3,
  Master: 4,
  MBA: 4,
  Doctorate: 5,
}

const PATTERNS: { level: DegreeLevel; pattern: RegExp }[] = [
  { level: 'Doctorate', pattern: /\b(ph\.?\s?d|doctor(ate)?|dphil)\b/i },
  { level: 'MBA', pattern: /\bm\.?\s?b\.?\s?a\b/i },
  { level: 'Master', pattern: /\b(m\.?\s?sc?|m\.?\s?eng|m\.?\s?a|masters?|master of)\b/i },
  { level: 'Bachelor', pattern: /\b(b\.?\s?sc?|b\.?\s?eng|b\.?\s?a|bachelors?|bachelor of|b\.?\s?tech)\b/i },
  { level: 'Diploma', pattern: /\b(diploma|associate)\b/i },
  { level: 'High school', pattern: /\b(high school|secondary|thanaweya)\b/i },
]

function levelFor(degree: string): DegreeLevel | null {
  for (const { level, pattern } of PATTERNS) {
    if (pattern.test(degree)) return level
  }
  return null
}

function fieldFromDegree(degree: string, level: DegreeLevel | null): string | null {
  if (!level || level === 'MBA') return null
  const stripped = degree
    .replace(PATTERNS.find((p) => p.level === level)!.pattern, ' ')
    .replace(/\b(of|in|degree|honours|honors|hons)\b/gi, ' ')
    .replace(/[.,;()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length > 1 ? stripped : null
}

export function normalizeEducation(
  entries: EducationEntry[] | null | undefined,
): NormalizedEducation {
  if (!entries || entries.length === 0) {
    return { highestDegree: null, fieldsOfStudy: [], schools: [] }
  }

  let highest: DegreeLevel | null = null
  const fields: string[] = []
  const schools: string[] = []

  for (const entry of entries) {
    if (entry.school && !schools.includes(entry.school)) schools.push(entry.school)

    const degree = entry.degree?.trim() ?? ''
    const level = degree ? levelFor(degree) : null
    if (level && (!highest || RANK[level] > RANK[highest])) highest = level

    const field = entry.field?.trim() || fieldFromDegree(degree, level)
    if (field && !fields.includes(field)) fields.push(field)
  }

  return { highestDegree: highest, fieldsOfStudy: fields, schools }
}
