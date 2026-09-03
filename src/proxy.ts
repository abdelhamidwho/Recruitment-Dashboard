import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PUBLIC_PATHS, SESSION_COOKIE } from '@/lib/auth/constants'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Forwarded so requireUser()/requireApiUser() can enforce the
  // mustChangePassword gate without proxy itself touching the
  // database — see src/lib/auth/requireUser.ts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  const withPathname = { request: { headers: requestHeaders } }

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next(withPathname)
  }

  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next(withPathname)
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const login = new URL('/login', request.url)
  login.searchParams.set('next', pathname)
  return NextResponse.redirect(login)
}

// Excludes _next/static, _next/image, favicon.ico, and anything under
// public/ — Next serves public/ files directly at the site root with no
// path prefix, so they're matched here by extension instead. Static assets
// are not secrets (candidate data is never served from public/), and a
// logged-out visitor still needs to load images on /login.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf|map)$).*)',
  ],
}
