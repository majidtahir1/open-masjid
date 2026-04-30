'use client'
import { useState, type ReactNode } from 'react'
import type { BillingState } from '@/lib/billing'

const FEATURES = [
  'Hosted on .openmasjid.app + your custom domain',
  'Prayer times are quick and easy to set up',
  'Events with uploaded or auto-generated flyer',
  'Native donations (Stripe — Sadaqah, Zakat, Building Fund)',
  'Custom branding: logo, three colors, font',
  'Unlimited admin users',
  '50 GB media storage · daily backups',
  'Email support (24h response)',
  'One free 30-min onboarding session',
  'Quarterly security updates (zero-touch)',
]

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))
}

type Props = {
  state: BillingState
  plan: string | null
  subscriptionPlan: string | null
  currentPeriodEnd: string | null
  gracePeriodEndsAt: string | null
  tenantName: string
}

export default function BillingClient({
  state,
  plan,
  subscriptionPlan,
  currentPeriodEnd,
  tenantName,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  const startCheckout = async (planChoice: 'monthly' | 'annual') => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: planChoice }),
      })
      const json = (await res.json()) as { url?: string; error?: string }
      if (json.url) {
        window.location.href = json.url
        return
      }
      setError(json.error ?? 'Checkout failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setBusy(false)
    }
  }

  const openPortal = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/billing/portal', { method: 'POST' })
      const json = (await res.json()) as { url?: string; error?: string }
      if (json.url) {
        window.location.href = json.url
        return
      }
      setError(json.error ?? 'Portal failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portal failed')
    } finally {
      setBusy(false)
    }
  }

  /* ---------- Headlines per state ---------- */
  let headline: ReactNode
  switch (state.kind) {
    case 'grandfathered':
      headline = 'Legacy free plan'
      break
    case 'pending':
      headline = 'Account pending'
      break
    case 'trial':
      headline = (
        <>
          You&apos;re on a free trial —{' '}
          <em className="italic text-[var(--icp-teal-700)]">
            {state.daysRemaining} day{state.daysRemaining === 1 ? '' : 's'} remaining.
          </em>
        </>
      )
      break
    case 'active':
      headline = 'Subscription active'
      break
    case 'past_due_trial':
      headline = 'Trial ended'
      break
    case 'past_due':
      headline = 'Payment past due'
      break
    case 'grace_period':
      headline = 'Subscription canceled'
      break
    case 'offline':
      headline = 'Site offline'
      break
  }

  const Shell = ({ children }: { children: ReactNode }) => (
    <main className="mx-auto max-w-[880px] px-6 py-10 md:px-10 md:py-12">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--icp-gold-700)] font-semibold mb-2">
        {tenantName} · Billing
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-[var(--icp-navy-700)] mb-8">
        {headline}
      </h1>
      {children}
    </main>
  )

  /* ---------- Pricing card (shared by trial + locked states) ---------- */
  const PricingCard = () => (
    <article className="relative rounded-2xl border-2 border-[var(--icp-navy-700)] bg-white p-8 shadow-sm">
      <span className="absolute -top-3 left-6 inline-flex rounded-md bg-[var(--icp-gold-300)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--icp-gray-900)]">
        Recommended
      </span>
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--icp-gray-700)] mb-3">
        Hosted
      </p>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="font-display text-5xl text-[var(--icp-navy-700)]">
          {billing === 'annual' ? '$490' : '$49'}
        </span>
        <span className="text-[var(--icp-gray-600)]">
          /{billing === 'annual' ? 'year' : 'mo'}
        </span>
      </div>
      <p className="text-[var(--icp-gray-600)] mb-6">
        {billing === 'annual'
          ? 'Save $98/year — 2 months free.'
          : 'For masajid that want a website, not a sysadmin job.'}
      </p>
      <button
        type="button"
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--icp-navy-700)] px-6 py-3 text-white font-semibold hover:bg-[var(--icp-navy-800)] disabled:opacity-50 mb-6"
        disabled={busy}
        onClick={() => void startCheckout(billing)}
      >
        Subscribe — {billing === 'annual' ? '$490/year' : '$49/month'} →
      </button>
      <ul className="space-y-3 border-t border-[var(--icp-gray-200)] pt-6">
        {FEATURES.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm text-[var(--icp-gray-700)]"
          >
            <svg
              className="mt-0.5 size-4 shrink-0 text-[var(--icp-success)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-4 text-sm text-[var(--icp-danger)]">{error}</p>
      )}
    </article>
  )

  const BillingToggle = () => (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 rounded-full bg-[var(--icp-gray-100)] p-1 mb-6"
    >
      <button
        type="button"
        role="tab"
        aria-selected={billing === 'monthly'}
        onClick={() => setBilling('monthly')}
        className={`rounded-full px-5 py-2 text-sm font-medium transition ${
          billing === 'monthly'
            ? 'bg-[var(--icp-navy-700)] text-white shadow-sm'
            : 'text-[var(--icp-gray-700)] hover:text-[var(--icp-navy-700)]'
        }`}
      >
        Monthly · $49/mo
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={billing === 'annual'}
        onClick={() => setBilling('annual')}
        className={`rounded-full px-5 py-2 text-sm font-medium transition ${
          billing === 'annual'
            ? 'bg-[var(--icp-navy-700)] text-white shadow-sm'
            : 'text-[var(--icp-gray-700)] hover:text-[var(--icp-navy-700)]'
        }`}
      >
        Annual · $490/yr
        <span className="ml-1.5 inline-flex rounded-full bg-[var(--icp-gold-300)] px-2 py-0.5 text-[11px] font-semibold text-[var(--icp-gold-700)] uppercase tracking-wide">
          2 months free
        </span>
      </button>
    </div>
  )

  /* ---------- Variant: grandfathered ---------- */
  if (state.kind === 'grandfathered') {
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--icp-gray-200)] bg-white p-8">
          <p className="text-[var(--icp-gray-700)]">
            This account predates billing and is on a free legacy plan with full
            access to all features. No action needed.
          </p>
        </div>
      </Shell>
    )
  }

  /* ---------- Variant: pending ---------- */
  if (state.kind === 'pending') {
    return (
      <Shell>
        <div className="rounded-xl bg-[var(--icp-gold-50)] text-[var(--icp-gold-700)] p-4 mb-6 font-medium">
          Your account is pending — please complete email verification before
          subscribing.
        </div>
      </Shell>
    )
  }

  /* ---------- Variant: active ---------- */
  if (state.kind === 'active') {
    const planLabel =
      (subscriptionPlan ?? plan) === 'annual'
        ? 'Annual ($490/yr)'
        : 'Monthly ($49/mo)'
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--icp-gray-200)] bg-white p-8">
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--icp-success)]/10 px-3 py-1 text-sm font-medium text-[var(--icp-success)]">
              <span className="size-2 rounded-full bg-[var(--icp-success)]" />
              Active
            </span>
            <span className="text-[var(--icp-gray-600)]">·</span>
            <span className="text-[var(--icp-gray-700)] font-medium">
              {planLabel}
            </span>
          </div>
          {currentPeriodEnd && (
            <p className="text-[var(--icp-gray-600)] mb-6">
              Next renewal:{' '}
              <strong className="text-[var(--icp-navy-700)]">
                {formatDate(currentPeriodEnd)}
              </strong>
            </p>
          )}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-[var(--icp-navy-700)] px-5 py-2.5 text-white font-medium hover:bg-[var(--icp-navy-800)] disabled:opacity-50"
            disabled={busy}
            onClick={() => void openPortal()}
          >
            Manage billing →
          </button>
          <p className="mt-3 text-sm text-[var(--icp-gray-600)]">
            Update payment method, view invoices, change plan, or cancel through
            Stripe&apos;s portal.
          </p>
          {error && (
            <p className="mt-3 text-sm text-[var(--icp-danger)]">{error}</p>
          )}
        </div>
      </Shell>
    )
  }

  /* ---------- Variant: trial ---------- */
  if (state.kind === 'trial') {
    return (
      <Shell>
        <p className="text-[var(--icp-gray-700)] text-lg mb-8 max-w-[640px]">
          Add a payment method to keep your masjid online after the trial. Same
          features either way — pick a cadence.
        </p>
        <BillingToggle />
        <PricingCard />
      </Shell>
    )
  }

  /* ---------- Variant: locked states (past_due_trial / past_due / grace_period / offline) ---------- */
  const banners: Record<
    'past_due_trial' | 'past_due' | 'grace_period' | 'offline',
    { bg: string; text: string; msg: string }
  > = {
    past_due_trial: {
      bg: 'bg-red-50',
      text: 'text-[var(--icp-danger)]',
      msg: 'Your free trial has ended. Editing is locked until you subscribe.',
    },
    past_due: {
      bg: 'bg-red-50',
      text: 'text-[var(--icp-danger)]',
      msg: 'Payment failed. Editing is locked until billing is restored.',
    },
    grace_period: {
      bg: 'bg-red-50',
      text: 'text-[var(--icp-danger)]',
      msg: `Subscription canceled. Your public site goes offline in ${
        state.kind === 'grace_period' ? state.daysRemaining : 0
      } day(s).`,
    },
    offline: {
      bg: 'bg-[var(--icp-gray-900)]',
      text: 'text-white',
      msg: 'Your public site is currently offline. Subscribe to bring it back.',
    },
  }
  const banner = banners[state.kind]

  return (
    <Shell>
      <div className={`rounded-xl ${banner.bg} ${banner.text} p-4 mb-6 font-medium`}>
        {banner.msg}
      </div>
      <BillingToggle />
      <PricingCard />
      <div className="mt-6">
        <button
          type="button"
          onClick={() => void openPortal()}
          disabled={busy}
          className="text-sm font-medium text-[var(--icp-navy-700)] hover:text-[var(--icp-navy-800)] underline-offset-4 hover:underline disabled:opacity-50"
        >
          Manage existing billing →
        </button>
      </div>
    </Shell>
  )
}
