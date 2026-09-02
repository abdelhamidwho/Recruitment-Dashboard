export type LanguageLevel = 'Native' | 'Full professional' | 'Professional' | 'Limited' | 'Elementary'

export interface NormalizedLanguage {
  name: string
  level: LanguageLevel | null
}

const LEVEL_PATTERNS: { level: LanguageLevel; pattern: RegExp }[] = [
  { level: 'Native', pattern: /native|bilingual|mother tongue/i },
  { level: 'Full professional', pattern: /full professional|fluent/i },
  { level: 'Professional', pattern: /professional working|professional|advanced/i },
  { level: 'Limited', pattern: /limited working|limited|intermediate/i },
  { level: 'Elementary', pattern: /elementary|basic|beginner/i },
]

export const LANGUAGE_LEVELS: LanguageLevel[] = [
  'Elementary',
  'Limited',
  'Professional',
  'Full professional',
  'Native',
]

function levelFor(value: unknown): LanguageLevel | null {
  if (typeof value !== 'string' || !value.trim()) return null
  for (const { level, pattern } of LEVEL_PATTERNS) {
    if (pattern.test(value)) return level
  }
  return null
}

/**
 * Normalizes a candidate's raw languages data into a de-duplicated list of
 * `{ name, level }` entries.
 *
 * Accepted input shapes: `raw` may be an array whose elements are either
 * bare strings (the language name, with an unknown level), or objects
 * carrying the name under `name` or `language`, and the proficiency under
 * `proficiency` or `level`. Any other input — non-array `raw`, or an array
 * element that is `null`/`undefined`/a primitive/an object without a usable
 * name — is skipped rather than throwing; a non-string `name`/`language` is
 * treated as absent. This function never throws, for any input.
 *
 * De-duplication is by name, case-insensitively, keeping the first-seen
 * casing and the first-seen level for that name.
 *
 * A `proficiency`/`level` value that isn't a string, or doesn't match any
 * known LinkedIn proficiency wording, yields `level: null` rather than
 * dropping the entry.
 *
 * `LANGUAGE_LEVELS` lists the possible levels ordered weakest to strongest.
 */
export function normalizeLanguages(raw: unknown): NormalizedLanguage[] {
  if (!Array.isArray(raw)) return []

  const result: NormalizedLanguage[] = []

  for (const entry of raw) {
    let name: string | null = null
    let level: LanguageLevel | null = null

    if (typeof entry === 'string') {
      name = entry.trim() || null
    } else if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>
      const candidate = record.name ?? record.language
      name = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
      level = levelFor(record.proficiency) ?? levelFor(record.level)
    }

    if (!name) continue
    if (result.some((existing) => existing.name.toLowerCase() === name.toLowerCase())) continue
    result.push({ name, level })
  }

  return result
}
