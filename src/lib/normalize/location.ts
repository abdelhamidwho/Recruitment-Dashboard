import { canonicalCountry, regionForCountry, type Region } from './regions'

export interface NormalizedLocation {
  raw: string | null
  city: string | null
  country: string | null
  region: Region | null
}

const NOT_A_PLACE = new Set(['remote', 'worldwide', 'anywhere', 'global', 'n/a', '-'])

/**
 * US state lookup: two-letter codes are exhaustive (all 50 states plus DC);
 * full-name spellings are only the common ones seen in profile data, with
 * abbreviations covering the rest. This partial list is deliberate, not unfinished.
 *
 * Note: When combined with parenthesis stripping, `"New York (NY)"` strips to `"New York"`,
 * which is in this set, so it resolves to country='United States' with city=null.
 * This narrow interaction only affects the few full-name US states that are also city names
 * (New York, Washington, Georgia) when written with parenthetical abbreviations.
 * The ordinary "New York, NY" form is unaffected and still works correctly.
 */
const US_STATES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me',
  'md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa',
  'ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc',
  'california','texas','new york','florida','washington','massachusetts','illinois','georgia',
  'virginia','colorado','arizona','oregon','michigan','ohio','north carolina','new jersey',
])

/**
 * Resolve a single comma-separated segment to a canonical country name, checking
 * both the country table and the US state lookup.
 */
function resolveCountryOrState(segment: string): string | null {
  const country = canonicalCountry(segment)
  if (country) return country
  if (US_STATES.has(segment.toLowerCase())) return 'United States'
  return null
}

/**
 * Normalise a city's casing only when the raw value is entirely lowercase or
 * entirely uppercase — an unambiguous sign the source stripped casing rather than
 * a deliberate spelling. Mixed-case values (e.g. "Rio de Janeiro", "San Francisco",
 * "'s-Hertogenbosch") pass through untouched, since a naive title-case would mangle
 * legitimate names. Strings with no cased letters at all (digits/punctuation only)
 * also pass through untouched, since there is nothing to normalise.
 */
function normalizeCityCasing(city: string): string {
  const isLower = city === city.toLowerCase()
  const isUpper = city === city.toUpperCase()

  if (isLower && isUpper) return city // no cased letters (e.g. purely numeric) - nothing to do
  if (!isLower && !isUpper) return city // mixed case - leave it alone

  return city
    .toLowerCase()
    .replace(/(^|[^a-zA-ZÀ-ɏ])([a-zA-ZÀ-ɏ])/g, (_m, boundary, letter) => boundary + letter.toUpperCase())
}

/**
 * Parse free-text location into city, country, and region.
 *
 * Parsing rules:
 * - The rightmost comma-separated segment is treated as the country or US state.
 * - If that segment is a recognised country or state, the leftmost remaining segment is the city.
 * - If the rightmost segment is not recognised, the other segments are checked instead:
 *   if exactly one of them resolves to a country or US state, that segment is treated as the
 *   country and the leftmost remaining segment is the city (e.g. "Egypt, Cairo" as well as
 *   "Cairo, Egypt"). If none or more than one of the other segments resolve, no reordering is
 *   attempted and the location falls back to the ordinary "unrecognised country" behaviour.
 * - If the country/state segment alone would make a single-token location, city is null.
 * - Work-mode words ('remote', 'worldwide', etc.) are stripped from parts; if all segments
 *   are stripped, the result is all nulls with raw preserved.
 * - Parenthesised groups are stripped before parsing, so "(Remote)" suffixes do not corrupt
 *   country/region resolution.
 * - A resolved city that is entirely lowercase or entirely uppercase is normalised to
 *   title case (e.g. "cairo" / "CAIRO" -> "Cairo") so facet counts aren't fragmented by
 *   incidental casing differences. Mixed-case city values are left exactly as scraped.
 * - Unparseable input yields all nulls with raw preserved, so no candidate is ever lost
 *   to a parsing failure.
 * - Never throws: a `raw` that is not a string (e.g. a number, array, or object — this data
 *   comes straight off an external scraper with no schema guarantee) is treated the same as
 *   missing input.
 */
export function normalizeLocation(raw: unknown): NormalizedLocation {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { raw: null, city: null, country: null, region: null }
  }

  const trimmed = raw.trim()
  if (NOT_A_PLACE.has(trimmed.toLowerCase())) {
    return { raw: trimmed, city: null, country: null, region: null }
  }

  // Strip parenthesised groups iteratively to handle nesting (e.g., "Cairo, Egypt (Remote)" -> "Cairo, Egypt")
  // Using [^()] instead of [^)] ensures we handle nested parens by stripping innermost first
  let cleaned = trimmed
  while (/\([^()]*\)/.test(cleaned)) {
    cleaned = cleaned.replace(/\s*\([^()]*\)\s*/g, ' ').trim()
  }

  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !NOT_A_PLACE.has(part.toLowerCase()))

  if (parts.length === 0) {
    return { raw: trimmed, city: null, country: null, region: null }
  }

  const last = parts[parts.length - 1]

  let country = resolveCountryOrState(last)
  let countryIndex = country ? parts.length - 1 : -1

  if (countryIndex === -1) {
    // The last segment isn't a recognised country/state — check whether exactly one of
    // the other segments is, to handle real-world reversed ordering like "Egypt, Cairo".
    const otherMatches: number[] = []
    for (let i = 0; i < parts.length - 1; i++) {
      if (resolveCountryOrState(parts[i])) otherMatches.push(i)
    }
    if (otherMatches.length === 1) {
      countryIndex = otherMatches[0]
      country = resolveCountryOrState(parts[countryIndex])
    }
  }

  let city: string | null
  if (countryIndex >= 0) {
    const remaining = parts.filter((_, i) => i !== countryIndex)
    city = remaining.length > 0 ? remaining[0] : null
  } else {
    city = parts[0]
  }

  if (city) {
    city = normalizeCityCasing(city)
  }

  return {
    raw: trimmed,
    city: city ?? null,
    country,
    region: regionForCountry(country),
  }
}
