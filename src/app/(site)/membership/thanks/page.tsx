/**
 * /membership/thanks — post-checkout landing page.
 *
 * Reads `session_id` from search params (Next.js 15 awaitable Promise),
 * retrieves the Stripe Checkout Session via the tenant's Connect account,
 * displays a personalised welcome, and shows a "Manage your membership"
 * button that POSTs to /api/membership/portal.
 *
 * Gracefully falls back to a generic thank-you when:
 *   - `session_id` is missing from the URL
 *   - Tenant or Stripe account is not configured
 *   - Stripe session retrieval fails for any reason
 */
import { getCurrentTenant } from '@/lib/tenant-server'
import { stripeForAccount } from '@/lib/stripe-connect'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Welcome — Membership' }

/** Duck-type helper — mirrors the pattern in membership-checkout.ts and the
 *  portal route. Resolves stripeAccountId from either the flat shape (test
 *  mocks) or the real Payload Tenant shape where it lives under donationConfig. */
function getStripeAccountId(tenant: unknown): string | null {
  const t = tenant as {
    stripeAccountId?: string | null
    donationConfig?: {
      stripeAccountId?: string | null
    }
  }
  return t.stripeAccountId ?? t.donationConfig?.stripeAccountId ?? null
}

interface Props {
  searchParams: Promise<{ session_id?: string; free?: string }>
}

/** Fallback shown whenever we can't retrieve a personalised session. */
function FallbackThanks() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[760px] px-6 text-center">
        <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
          Jazak Allahu khairan
        </div>
        <h1 className="mb-4 font-display text-[56px] font-medium leading-[1.06] tracking-tight text-fg1">
          Thanks for joining!
        </h1>
        <p className="m-0 mb-10 font-body text-fs-lg leading-relaxed text-fg2">
          Your membership is being set up. You&apos;ll receive an email confirmation shortly.
        </p>
      </div>
    </section>
  )
}

export default async function MembershipThanksPage({ searchParams }: Props) {
  const { session_id, free } = await searchParams

  const tenant = await getCurrentTenant()
  const tenantName = (tenant as { name?: string } | null)?.name ?? 'our masjid'

  // Free signup path — no Stripe session, no Customer Portal.
  if (free === '1') {
    return (
      <section className="py-20">
        <div className="mx-auto max-w-[760px] px-6 text-center">
          <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            Jazak Allahu khairan
          </div>
          <h1 className="mb-4 font-display text-[56px] font-medium leading-[1.06] tracking-tight text-fg1">
            Welcome to the community!
          </h1>
          <p className="m-0 mb-10 font-body text-fs-lg leading-relaxed text-fg2">
            Your membership at {tenantName} is now active. We&apos;ll be in touch
            with details about programs and events.
          </p>
        </div>
      </section>
    )
  }

  const stripeAccountId = tenant ? getStripeAccountId(tenant) : null

  // If we can't look up the session, show a friendly fallback — never 500.
  if (!tenant || !session_id || !stripeAccountId) {
    return <FallbackThanks />
  }

  let customerName = 'friend'
  let customerId = ''

  try {
    const stripe = stripeForAccount(stripeAccountId)
    const session = await stripe.checkout.sessions.retrieve(
      session_id,
      { expand: ['customer'] },
      { stripeAccount: stripeAccountId },
    )

    customerId =
      typeof session.customer === 'string'
        ? session.customer
        : (session.customer as { id?: string } | null)?.id ?? ''

    customerName = session.customer_details?.name ?? 'friend'
  } catch {
    // Stripe lookup failed (e.g. invalid session_id, network error) — fall back.
    return <FallbackThanks />
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[760px] px-6 text-center">
        <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
          Jazak Allahu khairan
        </div>
        <h1 className="mb-4 font-display text-[56px] font-medium leading-[1.06] tracking-tight text-fg1">
          Welcome, {customerName}!
        </h1>
        <p className="m-0 mb-10 font-body text-fs-lg leading-relaxed text-fg2">
          Your membership at {tenantName} is now active. A receipt has been emailed to you.
          May Allah bless your contribution and sustain this community.
        </p>

        {customerId && (
          <form action="/api/membership/portal" method="post">
            <input type="hidden" name="customerId" value={customerId} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-border bg-white px-8 py-[16px] font-body text-fs-base font-semibold text-fg2 shadow-sh-sm transition-all duration-base ease-out hover:-translate-y-px hover:border-border-teal hover:shadow-sh-md"
            >
              Manage your membership
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
