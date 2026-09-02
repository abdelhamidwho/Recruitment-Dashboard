export type Region =
  | 'GCC'
  | 'MENA'
  | 'Europe'
  | 'North America'
  | 'Latin America'
  | 'Sub-Saharan Africa'
  | 'South Asia'
  | 'East Asia'
  | 'Oceania'

const ALIASES: Record<string, string> = {
  uae: 'United Arab Emirates',
  'u.a.e.': 'United Arab Emirates',
  emirates: 'United Arab Emirates',
  ksa: 'Saudi Arabia',
  'saudi arabia': 'Saudi Arabia',
  saudi: 'Saudi Arabia',
  usa: 'United States',
  us: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  'northern ireland': 'United Kingdom',
}

const COUNTRY_REGIONS: Record<string, Region> = {
  'United Arab Emirates': 'GCC',
  'Saudi Arabia': 'GCC',
  Qatar: 'GCC',
  Kuwait: 'GCC',
  Bahrain: 'GCC',
  Oman: 'GCC',
  Egypt: 'MENA',
  Jordan: 'MENA',
  Lebanon: 'MENA',
  Morocco: 'MENA',
  Tunisia: 'MENA',
  Algeria: 'MENA',
  Libya: 'MENA',
  Iraq: 'MENA',
  Palestine: 'MENA',
  Syria: 'MENA',
  Yemen: 'MENA',
  Sudan: 'MENA',
  Turkey: 'MENA',
  'United States': 'North America',
  Canada: 'North America',
  Mexico: 'Latin America',
  Brazil: 'Latin America',
  Argentina: 'Latin America',
  Chile: 'Latin America',
  Colombia: 'Latin America',
  'United Kingdom': 'Europe',
  Ireland: 'Europe',
  Germany: 'Europe',
  France: 'Europe',
  Spain: 'Europe',
  Portugal: 'Europe',
  Italy: 'Europe',
  Netherlands: 'Europe',
  Belgium: 'Europe',
  Switzerland: 'Europe',
  Austria: 'Europe',
  Sweden: 'Europe',
  Norway: 'Europe',
  Denmark: 'Europe',
  Finland: 'Europe',
  Poland: 'Europe',
  Romania: 'Europe',
  Czechia: 'Europe',
  Greece: 'Europe',
  Ukraine: 'Europe',
  Nigeria: 'Sub-Saharan Africa',
  Kenya: 'Sub-Saharan Africa',
  Ghana: 'Sub-Saharan Africa',
  'South Africa': 'Sub-Saharan Africa',
  Ethiopia: 'Sub-Saharan Africa',
  India: 'South Asia',
  Pakistan: 'South Asia',
  Bangladesh: 'South Asia',
  'Sri Lanka': 'South Asia',
  Nepal: 'South Asia',
  China: 'East Asia',
  Japan: 'East Asia',
  'South Korea': 'East Asia',
  Singapore: 'East Asia',
  Malaysia: 'East Asia',
  Indonesia: 'East Asia',
  Philippines: 'East Asia',
  Vietnam: 'East Asia',
  Thailand: 'East Asia',
  Australia: 'Oceania',
  'New Zealand': 'Oceania',
}

const BY_LOWERCASE: Record<string, string> = Object.fromEntries(
  Object.keys(COUNTRY_REGIONS).map((name) => [name.toLowerCase(), name]),
)

export function canonicalCountry(value: string | null | undefined): string | null {
  if (!value) return null
  const key = value.trim().toLowerCase()
  if (!key) return null
  return ALIASES[key] ?? BY_LOWERCASE[key] ?? null
}

export function regionForCountry(value: string | null | undefined): Region | null {
  const country = canonicalCountry(value)
  return country ? COUNTRY_REGIONS[country] : null
}

export const KNOWN_COUNTRIES = Object.keys(COUNTRY_REGIONS)
