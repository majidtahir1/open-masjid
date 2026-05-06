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
import { verifyMembershipPortalToken } from '@/lib/membership-portal-token'

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
  const portalToken = form.get('portalToken')
  if (!portalToken || typeof portalToken !== 'string' || portalToken.trim() === '') {
    return NextResponse.json({ error: 'Missing portal token' }, { status: 400 })
  }

  let decoded: { tenantId: string | number; customerId: string }
  try {
    decoded = verifyMembershipPortalToken(portalToken)
  } catch {
    return NextResponse.json({ error: 'Invalid portal token' }, { status: 403 })
  }

  if (String(decoded.tenantId) !== String(tenant.id)) {
    return NextResponse.json({ error: 'Portal token tenant mismatch' }, { status: 403 })
  }

  const origin =
    req.headers.get('origin') ??
    `https://${(tenant as { slug?: string }).slug ?? ''}.openmasjid.app`

  const stripe = stripeForAccount(stripeAccountId)
  const session = await stripe.billingPortal.sessions.create(
    {
      customer: decoded.customerId,
      return_url: `${origin}/membership`,
    },
    { stripeAccount: stripeAccountId },
  )

  return NextResponse.redirect(session.url, 303)
}
