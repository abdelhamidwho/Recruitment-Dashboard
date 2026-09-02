export const SESSION_COOKIE = 'hrd_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const ROLES = { ADMIN: 'ADMIN', RECRUITER: 'RECRUITER' } as const
export type Role = (typeof ROLES)[keyof typeof ROLES]

export const STAGES = [
  'Sourced',
  'Contacted',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'Rejected',
] as const
export type Stage = (typeof STAGES)[number]

// Consumed by src/proxy.ts, which must not touch the database — it only
// checks cookie presence against these paths to decide whether a request
// needs a session at all.
export const PUBLIC_PATHS = ['/login', '/api/auth/login']
