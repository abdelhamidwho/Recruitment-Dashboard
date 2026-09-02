'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/requireUser'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { destroyAllSessionsFor, createSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export async function changePassword(
  _previous: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireUser()
  const current = String(formData.get('current') ?? '')
  const next = String(formData.get('next') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (next.length < 12) return { error: 'Use at least 12 characters.' }
  if (next !== confirm) return { error: 'The two new passwords do not match.' }
  if (next === current) return { error: 'Choose a password you have not used here before.' }

  const record = await prisma.user.findUnique({ where: { id: user.id } })
  if (!record || !(await verifyPassword(current, record.passwordHash))) {
    return { error: 'Your current password is incorrect.' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  })

  // Signing every device out after a password change is the point of changing it.
  await destroyAllSessionsFor(user.id)
  await createSession(user.id)
  redirect('/')
}
