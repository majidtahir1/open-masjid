/**
 * POST /api/membership/portal
 *
 * Reads `customerId` from form data, creates a Stripe Billing Portal session
 * on the tenant's connected account, then redirects 303 to the session URL.
 *
 * Security note: we scope the portal session to the tenant's own Stripe
 * connected account. An attacker cannot access another tenant's customers
 * through this route because the Connect account ID alone restricts lookups
 * to customers created on that account.
 */
import { NextResponse } from 'next/server'
import { getCurrentTenant } from '@/lib/tenant-server'
import { stripeForAccount } from '@/lib/stripe-connect'

/** Duck-type helper — resolves stripeAccountId from either the flat shape
 *  (test mocks) or the real Payload Tenant shape where it lives under
 *  `donationConfig`. Mirrors the pattern in membership-checkout.ts. */
function getStripeAccountId(tenant: unknown): string | null {
  const t = tenant as {
    stripeAccountId?: string | null
    donationConfig?: {
      stripeAccountId?: string | null
    }
  }
  return t.stripeAccountId ?? t.donationConfig?.stripeAccountId ?? null
}

export async function POST(req: Request) {
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const stripeAccountId = getStripeAccountId(tenant)
  if (!stripeAccountId) {
    return NextResponse.json({ error: 'Tenant Stripe not configured' }, { status: 404 })
  }

  const form = await req.formData()
  const customerId = form.get('customerId')
  if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
    return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })
  }

  const origin =
    req.headers.get('origin') ??
    `https://${(tenant as { slug?: string }).slug ?? ''}.openmasjid.app`

  const stripe = stripeForAccount(stripeAccountId)
  const session = await stripe.billingPortal.sessions.create(
    {
      customer: customerId,
      return_url: `${origin}/membership`,
    },
    { stripeAccount: stripeAccountId },
  )

  return NextResponse.redirect(session.url, 303)
}
