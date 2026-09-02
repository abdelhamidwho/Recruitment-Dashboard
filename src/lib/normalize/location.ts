import { canonicalCountry, regionForCountry, type Region } from './regions'

export interface NormalizedLocation {
  raw: string | null
  city: string | null
  country: string | null
  region: Region | null
}

const EMPTY: NormalizedLocation = { raw: null, city: null, country: null, region: null }

const NOT_A_PLACE = new Set(['remote', 'worldwide', 'anywhere', 'global', 'n/a', '-'])

const US_STATES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la','me',
  'md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok','or','pa',
  'ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc',
  'california','texas','new york','florida','washington','massachusetts','illinois','georgia',
  'virginia','colorado','arizona','oregon','michigan','ohio','north carolina','new jersey',
])

export function normalizeLocation(raw: string | null | undefined): NormalizedLocation {
  if (!raw || !raw.trim()) return EMPTY

  const trimmed = raw.trim()
  if (NOT_A_PLACE.has(trimmed.toLowerCase())) {
    return { raw: trimmed, city: null, country: null, region: null }
  }

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return EMPTY

  const last = parts[parts.length - 1]

  let country = canonicalCountry(last)
  if (!country && US_STATES.has(last.toLowerCase())) {
    country = 'United States'
  }

  const cityCandidate = parts.length > 1 ? parts[0] : null
  const city = country && parts.length === 1 ? null : cityCandidate ?? parts[0]

  return {
    raw: trimmed,
    city: city ?? null,
    country,
    region: regionForCountry(country),
  }
}
