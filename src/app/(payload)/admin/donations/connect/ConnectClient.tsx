'use client'

import { useState } from 'react'

type Props = {
  tenantName: string
  stripeAccountId: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
  status: string | null
}

const STATUS_MESSAGES: Record<string, string> = {
  missing: 'Stripe did not return an account. Please try connecting again.',
  invalid_state:
    'The connection request expired or was tampered with. Please try connecting again.',
  user_mismatch:
    'You signed in to Stripe as a different user than the one who started the connection. Please retry.',
  tenant_mismatch:
    'The connection request did not match this masjid. Please retry from this admin.',
  error: 'Something went wrong while connecting Stripe. Please try again.',
}

function maskAccountId(id: string): string {
  const last4 = id.slice(-4)
  return `acct_••• ${last4}`
}

export default function ConnectClient({
  tenantName,
  stripeAccountId,
  chargesEnabled,
  payoutsEnabled,
  status,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDisconnect = async () => {
    if (typeof window === 'undefined') return
    const ok = window.confirm(
      'Disconnect Stripe? Donors will not be able to give until you reconnect.',
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/connect/disconnect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        setError(json.error ?? 'Disconnect failed')
        return
      }
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed')
    } finally {
      setBusy(false)
    }
  }

  // ----- Not connected -----
  if (!stripeAccountId) {
    const showError = status && status !== 'success'
    const errMsg = showError ? STATUS_MESSAGES[status] ?? STATUS_MESSAGES.error : null

    return (
      <main className="mx-auto max-w-[820px] px-6 py-10 md:px-10 md:py-12">
        <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
          {tenantName} · Donations
        </div>
        <h1 className="mb-4 font-display text-[40px] font-medium leading-[1.08] tracking-tight text-fg1 md:text-[48px]">
          Accept donations on your site
        </h1>
        <p className="mb-8 max-w-[640px] font-body text-fs-lg leading-relaxed text-fg2">
          Connect your masjid to Stripe to accept Sadaqah, Zakat, and custom-fund
          donations directly on your site. Funds are paid out to your bank account
          by Stripe — OpenMasjid never touches the money.
        </p>

        {errMsg ? (
          <div className="mb-6 rounded-[var(--r-md)] border border-border bg-accent-soft px-4 py-3 font-body text-fs-sm text-fg1">
            {errMsg}
          </div>
        ) : null}

        <a
          href="/api/stripe/connect/authorize"
          className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-brand px-8 py-[16px] font-body text-fs-base font-semibold text-white shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md"
        >
          Connect Stripe
        </a>

        <p className="mt-6 max-w-[640px] font-body text-fs-sm leading-relaxed text-fg3">
          You will be redirected to Stripe to sign in or create an account. We
          ask only for what we need to send you donations.
        </p>
      </main>
    )
  }

  // ----- Connected -----
  const dashboardUrl = `https://dashboard.stripe.com/${stripeAccountId}/payments`

  return (
    <main className="mx-auto max-w-[820px] px-6 py-10 md:px-10 md:py-12">
      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
        {tenantName} · Donations
      </div>
      <h1 className="mb-8 font-display text-[40px] font-medium leading-[1.08] tracking-tight text-fg1 md:text-[48px]">
        Stripe connected
      </h1>

      <article className="rounded-[var(--r-md)] border border-border bg-white p-8 shadow-sh-sm">
        <div className="mb-6">
          <div className="mb-1 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
            Account
          </div>
          <div className="font-body text-fs-lg text-fg1">
            {maskAccountId(stripeAccountId)}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <span
            className={
              chargesEnabled
                ? 'inline-flex items-center rounded-pill bg-success-soft px-3 py-1 font-body text-fs-xs font-semibold text-success'
                : 'inline-flex items-center rounded-pill bg-accent-soft px-3 py-1 font-body text-fs-xs font-semibold text-fg1'
            }
          >
            {chargesEnabled ? '✓' : '•'} Charges enabled
          </span>
          <span
            className={
              payoutsEnabled
                ? 'inline-flex items-center rounded-pill bg-success-soft px-3 py-1 font-body text-fs-xs font-semibold text-success'
                : 'inline-flex items-center rounded-pill bg-accent-soft px-3 py-1 font-body text-fs-xs font-semibold text-fg1'
            }
          >
            {payoutsEnabled ? '✓' : '•'} Payouts enabled
          </span>
        </div>

        {!chargesEnabled || !payoutsEnabled ? (
          <p className="mb-6 font-body text-fs-sm leading-relaxed text-fg2">
            Stripe is still verifying your account. Finish any remaining steps in
            the Stripe Dashboard — donations will go live automatically once both
            checks pass.
          </p>
        ) : (
          <p className="mb-6 font-body text-fs-sm leading-relaxed text-fg2">
            Your account is fully verified. Donations will be paid out to your
            bank account on Stripe&apos;s standard schedule.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-brand px-6 py-[12px] font-body text-fs-base font-semibold text-white shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:bg-brand-hover hover:shadow-sh-md"
          >
            Open Stripe Dashboard
          </a>
          <button
            type="button"
            onClick={() => void onDisconnect()}
            disabled={busy}
            className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-6 py-[12px] font-body text-fs-base font-semibold text-fg2 hover:bg-bg-alt disabled:opacity-50"
          >
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>

        {error ? (
          <p className="mt-4 font-body text-fs-sm text-fg1">{error}</p>
        ) : null}
      </article>
    </main>
  )
}
