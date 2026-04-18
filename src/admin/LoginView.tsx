'use client'

/**
 * Custom admin login view — replaces Payload's default login form with a
 * shadcn-styled card that matches the Dashboard's visual language.
 *
 * This is a Client Component because it holds form state and handles the
 * POST to `/api/users/login` directly. On success, Payload sets an httpOnly
 * auth cookie and returns `{ user, token, exp }`; we then navigate to /admin.
 * On failure the API returns 401 with `{ errors: [{ message }] }`.
 *
 * We pull Tailwind + ICP tokens in via the globals.css import (same trick
 * Dashboard.tsx uses) so the admin shell — which doesn't load our app's CSS
 * by default — picks up the shadcn utility classes.
 */

import '@/app/globals.css'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn } from 'lucide-react'

import Logo from './Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PayloadLoginError = { message?: string }
type PayloadLoginResponse = {
  user?: unknown
  token?: string
  exp?: number
  errors?: PayloadLoginError[]
  message?: string
}

export default function LoginView() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data: PayloadLoginResponse = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg =
          data?.errors?.[0]?.message ||
          data?.message ||
          'Invalid email or password'
        setError(msg)
        setLoading(false)
        return
      }

      // Success — Payload set the cookie; land on the dashboard.
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-4 p-8 pb-4 text-center">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
              Welcome back
            </h1>
            <p className="text-muted-foreground text-base">
              Sign in to manage your masjid
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-4">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full text-base"
            >
              <LogIn className="h-5 w-5" aria-hidden />
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>

            <div className="text-center">
              <Link
                href="/admin/forgot"
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
