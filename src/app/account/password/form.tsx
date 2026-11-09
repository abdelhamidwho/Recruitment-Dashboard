'use client'

import { useActionState } from 'react'
import { changePassword } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="current" className="text-sm font-medium">
          Current password
        </label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="next" className="text-sm font-medium">
          New password
        </label>
        <Input id="next" name="next" type="password" autoComplete="new-password" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm" className="text-sm font-medium">
          New password again
        </label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Save password'}
      </Button>
    </form>
  )
}
