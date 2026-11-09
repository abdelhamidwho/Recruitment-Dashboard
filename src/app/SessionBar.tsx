import { getUser } from '@/lib/auth/requireUser'
import { ROLES } from '@/lib/auth/constants'
import { signOut } from './logout-action'
import { LayoutDashboard, LogOut, UserCircle } from 'lucide-react'

// Presentational only: signed-in name, admin link, sign-out. The
// mustChangePassword redirect used to live here, but SessionBar only
// renders inside the root layout's HTML tree, so it never ran for /api/*
// requests — see src/lib/auth/requireUser.ts (requireApiUser)
// for where that enforcement actually lives now.
export async function SessionBar() {
  const user = await getUser()
  if (!user) return null

  return (
    <div className="flex items-center justify-end gap-3 border-b bg-white px-6 py-2">
      <span className="flex items-center gap-2 font-medium">
        <UserCircle className="size-6 text-[var(--brand)]" aria-hidden />
        {user.name}
      </span>
      {user.role === ROLES.ADMIN ? (
        <a href="/admin" className="lux-nav-link">
          <LayoutDashboard aria-hidden />
          Admin
        </a>
      ) : null}
      <form action={signOut}>
        <button type="submit" className="lux-nav-link">
          <LogOut aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  )
}
