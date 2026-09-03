'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'node:crypto'
import { requireAdmin } from '@/lib/auth/requireUser'
import { hashPassword } from '@/lib/auth/password'
import { destroyAllSessionsFor } from '@/lib/auth/session'
import { ROLES } from '@/lib/auth/constants'
import { prisma } from '@/lib/prisma'

function temporaryPassword(): string {
  return randomBytes(9).toString('base64url')
}

export async function createUser(
  _previous: { error?: string; created?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; created?: string }> {
  await requireAdmin()

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim()
  const role = String(formData.get('role') ?? ROLES.RECRUITER)

  if (!email || !name) return { error: 'Name and email are both required.' }
  if (role !== ROLES.ADMIN && role !== ROLES.RECRUITER) return { error: 'Unknown role.' }
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: 'That email already has an account.' }
  }

  const password = temporaryPassword()
  await prisma.user.create({
    data: {
      email,
      name,
      role,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    },
  })

  revalidatePath('/admin/users')
  return { created: `${email} — temporary password: ${password}` }
}

export async function resetPassword(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const password = temporaryPassword()
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true },
  })
  await destroyAllSessionsFor(id)

  console.log(`[admin] temporary password for ${id}: ${password}`)
  revalidatePath('/admin/users')
}

export async function setActive(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const isActive = String(formData.get('isActive') ?? '') === 'true'
  if (!id || id === admin.id) return // an admin cannot lock themselves out

  await prisma.user.update({ where: { id }, data: { isActive } })
  if (!isActive) await destroyAllSessionsFor(id)
  revalidatePath('/admin/users')
}
