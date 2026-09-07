'use server'

import { redirect } from 'next/navigation'
import { destroyCurrentSession } from '@/lib/auth/session'

/**
 * Sign-out for the UI button.
 *
 * The `/api/auth/logout` route handler stays as the programmatic endpoint and
 * returns JSON, which is right for a scripted client but wrong for a browser:
 * posting a form straight to it leaves the person staring at `{"ok":true}`.
 * This action clears the session and sends them to the login page instead.
 *
 * `redirect()` works by throwing, so it must stay outside any try/catch.
 */
export async function signOut(): Promise<void> {
  await destroyCurrentSession()
  redirect('/login')
}
