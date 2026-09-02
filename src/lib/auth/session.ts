import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, SESSION_TTL_MS } from './constants'
import { generateSessionToken, hashSessionToken, isExpired, sessionExpiry } from './token'

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
    secure: process.env.NODE_ENV === 'production',
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
