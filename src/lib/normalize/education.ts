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

// Master and MBA deliberately share a rank: an MBA is a masters-level qualification, but HR
// needs to filter for it specifically, so it is kept as its own DegreeLevel rather than being
// collapsed into 'Master'. On a tie, whichever is encountered first across the entries wins.
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

// Field-of-study parsing is split across three pieces that must be kept in sync by hand:
//   - PATTERNS above recognises the degree level from the free-text degree string.
//   - FIELD_ELIGIBLE_LEVELS (below) says at which levels a "field of study" is even a
//     meaningful concept — extend it only when that's true for a newly added level.
//   - GENERIC_FIELD_WORDS (below) catches single-word leftovers of the degree's own name
//     (e.g. stripping "Master of Science" leaves "Science") — extend it if a new pattern's
//     strip leaves behind another generic single word.
// FIELD_ELIGIBLE_LEVELS must stay a subset of the levels present in PATTERNS: fieldFromDegree
// asserts that PATTERNS has an entry for the level, and that assertion is only safe because of
// this (currently unenforced) invariant.
const FIELD_ELIGIBLE_LEVELS: DegreeLevel[] = ['Bachelor', 'Master', 'Doctorate']

// Generic words that are part of a degree's own name, not a field of study — a parsed
// (not explicit) field consisting of exactly one of these words is discarded.
const GENERIC_FIELD_WORDS = new Set([
  'science',
  'arts',
  'letters',
  'philosophy',
  'commerce',
  'technology',
  'studies',
  'general',
  'certificate',
  'honours',
  'honors',
])

function levelFor(degree: string): DegreeLevel | null {
  for (const { level, pattern } of PATTERNS) {
    if (pattern.test(degree)) return level
  }
  return null
}

function fieldFromDegree(degree: string, level: DegreeLevel | null): string | null {
  if (!level || !FIELD_ELIGIBLE_LEVELS.includes(level)) return null
  const stripped = degree
    .replace(PATTERNS.find((p) => p.level === level)!.pattern, ' ')
    .replace(/\b(of|in|degree|honours|honors|hons)\b/gi, ' ')
    .replace(/[.,;()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length <= 1) return null
  const words = stripped.split(' ')
  if (words.length === 1 && GENERIC_FIELD_WORDS.has(words[0].toLowerCase())) return null
  return stripped
}

// Adds `value` to `seen`/`order` the first time its lowercased form is encountered, keeping
// the first-seen casing for display while de-duplicating case-insensitively. Fields and
// schools both use this so facet counts don't fragment across "Computer Science" vs
// "computer science".
function addCaseInsensitive(value: string, seen: Set<string>, order: string[]): void {
  const key = value.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  order.push(value)
}

/**
 * Derives a highest degree level, distinct fields of study, and distinct schools from a
 * candidate's raw, untrusted education entries.
 *
 * Never throws, and never drops a candidate for having unparsable data:
 *  - `entries` may be null/undefined/empty/a truthy non-array (a number, string, or plain
 *    object — treated the same as "no data"), and any element of the array that is not a
 *    non-null object (e.g. `null`, a primitive, an array) is skipped rather than crashing
 *    the whole call.
 *  - Within a surviving element, a non-string `school`/`degree`/`field` is treated as absent.
 *  - An explicit `field` on an entry always wins over one parsed from `degree`, and it
 *    bypasses BOTH the field-eligible-level gate and the generic-word stop list — so
 *    `{ degree: 'Diploma', field: 'Certificate' }` yields `fieldsOfStudy: ['Certificate']`
 *    even though 'Diploma' is not field-eligible and "certificate" is itself a stop word.
 *    This is intentional: an explicit field is authoritative, a parsed one is a guess.
 *  - A field is only ever parsed out of the degree string for Bachelor, Master and
 *    Doctorate levels (see FIELD_ELIGIBLE_LEVELS), and a single generic leftover word
 *    (see GENERIC_FIELD_WORDS) is discarded rather than surfaced as a fake field.
 *  - `fieldsOfStudy` and `schools` are both de-duplicated case-insensitively, preserving
 *    the casing of the first occurrence of each value.
 */
export function normalizeEducation(
  entries: unknown,
): NormalizedEducation {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { highestDegree: null, fieldsOfStudy: [], schools: [] }
  }

  let highest: DegreeLevel | null = null
  const fields: string[] = []
  const fieldKeys = new Set<string>()
  const schools: string[] = []
  const schoolKeys = new Set<string>()

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue

    const school = typeof entry.school === 'string' ? entry.school.trim() : ''
    const degree = typeof entry.degree === 'string' ? entry.degree.trim() : ''
    const explicitField = typeof entry.field === 'string' ? entry.field.trim() : ''

    if (school) addCaseInsensitive(school, schoolKeys, schools)

    const level = degree ? levelFor(degree) : null
    if (level && (!highest || RANK[level] > RANK[highest])) highest = level

    const field = explicitField || fieldFromDegree(degree, level)
    if (field) addCaseInsensitive(field, fieldKeys, fields)
  }

  return { highestDegree: highest, fieldsOfStudy: fields, schools }
}
