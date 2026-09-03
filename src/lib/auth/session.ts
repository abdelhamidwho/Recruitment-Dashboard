import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, SESSION_TTL_MS } from './constants'
import { generateSessionToken, hashSessionToken, isExpired, sessionExpiry } from './token'

// The session cookie's `Secure` flag must not be derived from NODE_ENV: this app's
// deployment target is a single shared server on a company LAN that may well be
// plain HTTP. `NODE_ENV=production` over HTTP would set `Secure` and browsers would
// silently refuse to store or send the cookie (login appears to work, no session
// persists). `NODE_ENV` unset over a real HTTPS deployment would omit `Secure` and
// leak the session token in cleartext. So this is an explicit, separate decision,
// defaulting to the safe choice (secure) so that running insecurely requires
// deliberately opting out via SESSION_COOKIE_SECURE=false.
function sessionCookieSecure(): boolean {
  return process.env.SESSION_COOKIE_SECURE !== 'false'
}

export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken()
  const expiresAt = sessionExpiry()

  await prisma.session.create({
    data: { id: hashSessionToken(token), userId, expiresAt },
  })

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: sessionCookieSecure(),
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { id: hashSessionToken(token) } })
  }
  jar.delete(SESSION_COOKIE)
}

export async function destroyAllSessionsFor(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  mustChangePassword: boolean
}

export async function readSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { id: hashSessionToken(token) },
    include: { user: true },
  })

  if (!session) return null
  if (isExpired(session.expiresAt)) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (!session.user.isActive) return null

  const { id, email, name, role, mustChangePassword } = session.user
  return { id, email, name, role, mustChangePassword }
}
