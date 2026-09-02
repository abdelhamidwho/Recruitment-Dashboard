import { requireUser } from '@/lib/auth/requireUser'
import { PasswordForm } from './form'

export default async function PasswordPage() {
  const user = await requireUser()
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-1 text-xl font-semibold">
        {user.mustChangePassword ? 'Choose a new password' : 'Change your password'}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {user.mustChangePassword
          ? 'This account still uses the password it was created with.'
          : 'You will be signed out on your other devices.'}
      </p>
      <PasswordForm />
    </main>
  )
}
