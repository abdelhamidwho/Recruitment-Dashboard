import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/requireUser'
import { ROLES } from '@/lib/auth/constants'

const PASSWORD_PATH = '/account/password'

export async function SessionBar() {
  const user = await getUser()
  if (!user) return null

  // The login flow sends a user with mustChangePassword straight to
  // /account/password, but nothing stops them navigating to any other page
  // afterwards — the proxy only checks that a session cookie exists, not
  // whether the account is still using its bootstrap/reset password. Since
  // SessionBar renders on every page (it lives in the root layout), this is
  // where that gets enforced for real: pathname is forwarded by
  // src/proxy.ts as a request header (proxy itself must not query the
  // database, so it cannot know mustChangePassword on its own).
  const jar = await headers()
  const pathname = jar.get('x-pathname') ?? ''
  if (user.mustChangePassword && pathname !== PASSWORD_PATH) {
    redirect(PASSWORD_PATH)
  }

  return (
    <div className="flex items-center justify-end gap-4 border-b px-6 py-2 text-sm">
      <span className="text-muted-foreground">{user.name}</span>
      {user.role === ROLES.ADMIN ? (
        <a href="/admin/users" className="underline">
          Users
        </a>
      ) : null}
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="underline">
          Sign out
        </button>
      </form>
    </div>
  )
}
