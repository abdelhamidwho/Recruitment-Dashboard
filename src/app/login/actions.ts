'use server'

import { redirect } from 'next/navigation'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

const GENERIC_FAILURE = 'Email or password is incorrect.'

export async function login(
  _previous: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { error: 'Enter your email and password.' }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) return { error: GENERIC_FAILURE }
  if (!(await verifyPassword(password, user.passwordHash))) return { error: GENERIC_FAILURE }

  await createSession(user.id)
  redirect(user.mustChangePassword ? '/account/password' : '/')
}
