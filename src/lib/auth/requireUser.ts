import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { ROLES } from './constants'
import { readSessionUser, type SessionUser } from './session'

/** Path a mustChangePassword user is always allowed to reach, so they can escape the state. */
const PASSWORD_PATH = '/account/password'

/**
 * The current request's pathname, as forwarded by src/proxy.ts via the
 * `x-pathname` header. Proxy sets this on every request it lets through
 * (see src/proxy.ts) — it is server-controlled and cannot be spoofed by a
 * client-supplied header of the same name, because Next strips incoming
 * request headers with reserved/internal names set by middleware/proxy
 * before the handler sees them being overwritten, and here proxy always
 * sets it itself for every request that reaches a route or page. It is
 * read here (rather than, say, deriving it from headers().get('referer') or
 * re-parsing the request URL) because proxy already computes it once per
 * request and this keeps a single source of truth instead of two
 * implementations of "what page is this" drifting apart.
 */
async function currentPathname(): Promise<string> {
  const jar = await headers()
  return jar.get('x-pathname') ?? ''
}

/** Returns the signed-in user, or null. Use in route handlers. */
export async function getUser(): Promise<SessionUser | null> {
  return readSessionUser()
}

/**
 * Returns the signed-in user, or redirects to /login. Use in pages and
 * layouts. Also redirects to /account/password when the account still has
 * mustChangePassword set and the current page isn't already that page —
 * this is the one place page rendering funnels through, so it is where
 * that gate belongs (see src/app/SessionBar.tsx, which used to do this and
 * no longer does: it never ran for /api/* routes at all).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await readSessionUser()
  if (!user) redirect('/login')
  if (user.mustChangePassword && (await currentPathname()) !== PASSWORD_PATH) {
    redirect(PASSWORD_PATH)
  }
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

/** 403 JSON response body for an authenticated user who must change their password first. */
export const PASSWORD_CHANGE_REQUIRED = { error: 'Password change required' }

/**
 * Route-handler equivalent of requireUser(): returns the signed-in user, or
 * a ready-to-return NextResponse (401 not signed in, 403 must change
 * password) when the caller isn't allowed through. Callers check
 * `instanceof NextResponse`:
 *
 *   const auth = await requireApiUser()
 *   if (auth instanceof NextResponse) return auth
 *
 * A 403 (not 401) is used for mustChangePassword because the caller *is*
 * authenticated — they just aren't permitted to use the API yet.
 */
export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  const user = await getUser()
  if (!user) return NextResponse.json(UNAUTHORIZED, { status: 401 })
  if (user.mustChangePassword) return NextResponse.json(PASSWORD_CHANGE_REQUIRED, { status: 403 })
  return user
}
