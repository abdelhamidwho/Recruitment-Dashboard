'use client'

import { useActionState } from 'react'
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IdhLogo } from "@/components/IdhLogo"

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {})

  return (
    <main className="flex min-h-[85vh] items-center justify-center p-6">
      <form action={formAction} className="lux-rise w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-lg">
        <div className="flex flex-col items-center gap-4 pb-2 text-center">
          <IdhLogo size={72} stacked />
          <hr className="lux-hairline w-full" />
          <p className="text-base text-muted-foreground">Sign in to continue</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-base font-semibold">
            Email
          </label>
          <Input id="email" name="email" type="email" autoComplete="username" required />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-base font-semibold">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {state?.error ? (
          <p role="alert" className="text-base text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  )
}
