import { redirect } from 'next/navigation'
import { ROLES } from './constants'
import { readSessionUser, type SessionUser } from './session'

/** Returns the signed-in user, or null. Use in route handlers. */
export async function getUser(): Promise<SessionUser | null> {
  return readSessionUser()
}

/** Returns the signed-in user, or redirects to /login. Use in pages and layouts. */
export async function requireUser(): Promise<SessionUser> {
  const user = await readSessionUser()
  if (!user) redirect('/login')
  return user
}

/** Returns the signed-in admin, or redirects. Use in admin pages. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== ROLES.ADMIN) redirect('/')
  return user
}

/** 401 JSON response body, so every route handler answers identically. */
export const UNAUTHORIZED = { error: 'Not signed in' }
