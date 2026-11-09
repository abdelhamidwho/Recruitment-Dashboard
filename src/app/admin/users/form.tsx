'use client'

import { useActionState } from 'react'
import { createUser } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, {})

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <label htmlFor="role" className="text-sm font-medium">
          Role
        </label>
        <select id="role" name="role" className="h-9 rounded-md border px-3 text-sm">
          <option value="RECRUITER">Recruiter</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Add user'}
      </Button>
      {state?.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state?.created ? (
        <p className="w-full text-sm text-chart-2">Created {state.created}</p>
      ) : null}
    </form>
  )
}
