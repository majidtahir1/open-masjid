'use client'
import { useState } from 'react'
import type { BillingState } from '@/lib/billing'

export default function BillingClient({
  state,
  plan,
}: {
  state: BillingState
  plan: string | null
}) {
  const [busy, setBusy] = useState(false)

  const startCheckout = async (planChoice: 'monthly' | 'annual') => {
    setBusy(true)
    const res = await fetch('/api/stripe/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: planChoice }),
    })
    const json = (await res.json()) as { url?: string; error?: string }
    if (json.url) window.location.href = json.url
    else {
      setBusy(false)
      alert(json.error ?? 'Checkout failed')
    }
  }

  const openPortal = async () => {
    setBusy(true)
    const res = await fetch('/api/stripe/billing/portal', { method: 'POST' })
    const json = (await res.json()) as { url?: string; error?: string }
    if (json.url) window.location.href = json.url
    else {
      setBusy(false)
      alert(json.error ?? 'Portal failed')
    }
  }

  if (state.kind === 'grandfathered') {
    return <p>This account predates billing and is on a free legacy plan.</p>
  }
  if (state.kind === 'pending') {
    return <p>Account is pending — please complete email verification before billing.</p>
  }
  if (state.kind === 'active') {
    return (
      <>
        <p>
          Subscription is <strong>active</strong> ({plan ?? 'unknown plan'}).
        </p>
        <button disabled={busy} onClick={openPortal}>Manage billing</button>
      </>
    )
  }
  if (state.kind === 'trial') {
    return (
      <>
        <p>
          You&apos;re on a free trial — <strong>{state.daysRemaining} day(s) remaining</strong>.
        </p>
        <p>Add a payment method to continue after the trial:</p>
        <button disabled={busy} onClick={() => startCheckout('monthly')}>
          Subscribe — $49/month
        </button>{' '}
        <button disabled={busy} onClick={() => startCheckout('annual')}>
          Subscribe — $490/year (2 months free)
        </button>
      </>
    )
  }
  // past_due_trial, past_due, grace_period, offline
  const label = state.kind.replace(/_/g, ' ')
  return (
    <>
      <p style={{ color: '#b91c1c' }}>
        Your account is currently <strong>{label}</strong>.
      </p>
      <p>Reactivate by adding a payment method:</p>
      <button disabled={busy} onClick={() => startCheckout('monthly')}>
        Subscribe — $49/month
      </button>{' '}
      <button disabled={busy} onClick={() => startCheckout('annual')}>
        Subscribe — $490/year
      </button>{' '}
      <button disabled={busy} onClick={openPortal}>
        Manage existing billing
      </button>
    </>
  )
}
