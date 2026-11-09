import { requireAdmin } from '@/lib/auth/requireUser'
import { prisma } from '@/lib/prisma'
import { resetPassword, setActive } from './actions'
import { CreateUserForm } from './form'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

export default async function UsersPage() {
  const admin = await requireAdmin()
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })

  return (
    <main className="min-h-screen">
      <PageHeader
        title="Team accounts"
        subtitle="New accounts get a temporary password and must change it on first sign-in."
      />
      <div className="mx-auto max-w-5xl space-y-8 p-6">

      <CreateUserForm />

      <table className="w-full text-base">
        <thead>
          <tr className="border-b text-left">
            <th className="py-3">Name</th>
            <th className="py-3">Email</th>
            <th className="py-3">Role</th>
            <th className="py-3">Status</th>
            <th className="py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b">
              <td className="py-3">{user.name}</td>
              <td className="py-3">{user.email}</td>
              <td className="py-3">{user.role}</td>
              <td className="py-3">{user.isActive ? 'Active' : 'Disabled'}</td>
              <td className="py-3">
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
      </div>
    </main>
  )
}
