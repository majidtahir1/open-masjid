'use client'

import { useSearchParams } from 'next/navigation'

export function CheckEmailContent() {
  const params = useSearchParams()
  const email = params.get('email') ?? ''
  return (
    <p className="om-lede">
      We sent a setup link to{' '}
      {email ? (
        <strong>{email}</strong>
      ) : (
        <span>your inbox</span>
      )}
      . Click the link to set your password, then you'll land in your masjid's admin where the
      onboarding wizard will walk you through the rest. The link is single-use and works for the
      next 24 hours.
    </p>
  )
}
