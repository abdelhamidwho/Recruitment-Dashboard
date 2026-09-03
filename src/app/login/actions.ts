'use server'

import { redirect } from 'next/navigation'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

const GENERIC_FAILURE = 'Email or password is incorrect.'

// Computed once per module load and memoized, so an unknown-email login
// still pays a real scrypt cost before answering — otherwise "no such
// user" resolves ~4x faster than "wrong password for a real user", which
// is enough of a timing signal to re-enable the account enumeration the
// identical GENERIC_FAILURE message exists to prevent. The password and
// stored hash here are never used to authenticate anything; only the cost
// of deriving them matters.
const dummyHash = hashPassword('dummy-password-for-timing-safety')

export async function login(
  _previous: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { error: 'Enter your email and password.' }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) {
    await verifyPassword(password, await dummyHash)
    return { error: GENERIC_FAILURE }
  }
  if (!(await verifyPassword(password, user.passwordHash))) return { error: GENERIC_FAILURE }

  await createSession(user.id)
  redirect(user.mustChangePassword ? '/account/password' : '/')
}
