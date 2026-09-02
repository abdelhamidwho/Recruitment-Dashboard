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
 */
const US_STATES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me',
  'md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa',
  'ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc',
  'california','texas','new york','florida','washington','massachusetts','illinois','georgia',
  'virginia','colorado','arizona','oregon','michigan','ohio','north carolina','new jersey',
])

/**
 * Parse free-text location into city, country, and region.
 *
 * Parsing rules:
 * - The rightmost comma-separated segment is treated as the country or US state.
 * - If that segment is a recognised country or state, the leftmost segment is the city.
 * - If the country/state segment alone would make a single-token location, city is null.
 * - Work-mode words ('remote', 'worldwide', etc.) are stripped from parts; if all segments
 *   are stripped, the result is all nulls with raw preserved.
 * - Parenthesised groups are stripped before parsing, so "(Remote)" suffixes do not corrupt
 *   country/region resolution.
 * - Unparseable input yields all nulls with raw preserved, so no candidate is ever lost
 *   to a parsing failure.
 */
export function normalizeLocation(raw: string | null | undefined): NormalizedLocation {
  if (!raw || !raw.trim()) {
    return { raw: null, city: null, country: null, region: null }
  }

  const trimmed = raw.trim()
  if (NOT_A_PLACE.has(trimmed.toLowerCase())) {
    return { raw: trimmed, city: null, country: null, region: null }
  }

  // Strip parenthesised groups (e.g., "Cairo, Egypt (Remote)" -> "Cairo, Egypt")
  const cleaned = trimmed.replace(/\s*\([^)]*\)\s*/g, '').trim()

  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !NOT_A_PLACE.has(part.toLowerCase()))

  if (parts.length === 0) {
    return { raw: trimmed, city: null, country: null, region: null }
  }

  const last = parts[parts.length - 1]

  let country = canonicalCountry(last)
  if (!country && US_STATES.has(last.toLowerCase())) {
    country = 'United States'
  }

  const city = parts.length === 1 && country ? null : parts[0]

  return {
    raw: trimmed,
    city: city ?? null,
    country,
    region: regionForCountry(country),
  }
}
