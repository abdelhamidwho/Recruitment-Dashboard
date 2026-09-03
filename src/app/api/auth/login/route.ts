import { NextResponse } from 'next/server'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

// See src/app/login/actions.ts for why this exists: it makes the
// unknown-email path pay the same scrypt cost as a wrong-password path for
// a real user, closing the timing side-channel that would otherwise let a
// caller distinguish "no such account" from "wrong password" by latency
// alone.
const dummyHash = hashPassword('dummy-password-for-timing-safety')

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) {
    await verifyPassword(password, await dummyHash)
    return NextResponse.json({ error: 'Email or password is incorrect' }, { status: 401 })
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Email or password is incorrect' }, { status: 401 })
  }

  await createSession(user.id)
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  })
}
