import { getUser } from '@/lib/auth/requireUser'
import { ROLES } from '@/lib/auth/constants'

// Presentational only: signed-in name, admin link, sign-out. The
// mustChangePassword redirect used to live here, but SessionBar only
// renders inside the root layout's HTML tree, so it never ran for /api/*
// requests — see src/lib/auth/requireUser.ts (requireUser, requireApiUser)
// for where that enforcement actually lives now.
export async function SessionBar() {
  const user = await getUser()
  if (!user) return null

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
