import industries from '@/data/industries.json'

// Copied into Object.create(null) tables (rather than used as plain JSON objects) so that
// bracket lookups with an attacker/scraper-controlled key such as "constructor" or
// "__proto__" cannot resolve to an inherited value off Object.prototype. See
// src/lib/normalize/regions.ts for the same convention.
const ALIASES: Record<string, string> = Object.create(null)
Object.assign(ALIASES, industries.aliases)

const COMPANIES: Record<string, string> = Object.create(null)
Object.assign(COMPANIES, industries.companies)

const CANONICAL = new Set(Object.values(ALIASES))

/**
 * Canonicalises a candidate's industry into one of the fixed set of names in `INDUSTRIES`,
 * preferring the profile's own stated industry and falling back to a guess from the
 * candidate's current company only when the profile industry is missing or unrecognised.
 *
 * Contract:
 * - `profileIndustry` is looked up (case-insensitively, trimmed) against a hand-curated
 *   alias table; if it doesn't match an alias but is already one of the canonical names
 *   verbatim, that canonical name is returned as-is.
 * - Only when `profileIndustry` yields nothing does `company` get consulted, against a
 *   small table covering the mock/fixture companies only.
 * - Never throws and never returns `undefined`: any input — `null`, `undefined`, a number,
 *   an object, an array, or an empty string, for either argument — is treated as "no data"
 *   and falls through to the next source or to a `null` return. Lookups use own-property
 *   tables (see ALIASES/COMPANIES above) so a key like `'constructor'` or `'__proto__'`
 *   cannot leak an inherited value off `Object.prototype`.
 * - Returns `null` when neither source resolves to a known industry.
 */
export function normalizeIndustry(
  profileIndustry: unknown,
  company: unknown,
): string | null {
  if (typeof profileIndustry === 'string') {
    const raw = profileIndustry.trim().toLowerCase()
    if (raw) {
      const aliased = ALIASES[raw]
      if (aliased) return aliased
      const titled = profileIndustry.trim()
      if (CANONICAL.has(titled)) return titled
    }
  }

  if (typeof company === 'string') {
    const companyKey = company.trim().toLowerCase()
    if (companyKey) {
      const matched = COMPANIES[companyKey]
      if (matched) return matched
    }
  }

  return null
}

export const INDUSTRIES = Array.from(CANONICAL).sort()
