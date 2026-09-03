import { requireAdmin } from '@/lib/auth/requireUser'
import { prisma } from '@/lib/prisma'
import { resetPassword, setActive } from './actions'
import { CreateUserForm } from './form'
import { Button } from '@/components/ui/button'

export default async function UsersPage() {
  const admin = await requireAdmin()
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          New accounts get a temporary password and must change it on first sign-in.
        </p>
      </div>

      <CreateUserForm />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b">
              <td className="py-2">{user.name}</td>
              <td className="py-2">{user.email}</td>
              <td className="py-2">{user.role}</td>
              <td className="py-2">{user.isActive ? 'Active' : 'Disabled'}</td>
              <td className="py-2">
                <div className="flex justify-end gap-2">
                  <form action={resetPassword}>
                    <input type="hidden" name="id" value={user.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Reset password
                    </Button>
                  </form>
                  {user.id === admin.id ? null : (
                    <form action={setActive}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="isActive" value={String(!user.isActive)} />
                      <Button type="submit" variant="outline" size="sm">
                        {user.isActive ? 'Disable' : 'Enable'}
                      </Button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
