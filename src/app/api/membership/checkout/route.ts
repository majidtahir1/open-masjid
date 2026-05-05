/**
 * POST /api/membership/checkout
 *
 * Reads `tierId` from form data, loads the tier + tenant, validates
 * ownership, builds a Stripe Checkout Session in subscription mode via
 * the tenant's Connect account, then redirects to the session URL.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { stripeForAccount } from '@/lib/stripe-connect'
import { buildCheckoutSessionArgs } from '@/lib/membership-checkout'

export async function POST(req: Request) {
  // Resolve the tenant from request headers (set by middleware)
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Parse form data — the /membership page posts tierId as a form field
  const form = await req.formData()
  const tierId = form.get('tierId')
  if (!tierId) {
    return NextResponse.json({ error: 'Missing tierId' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // Load the tier; enforce ownership (tier must belong to this tenant)
  const tier = await payload.findByID({
    collection: 'membership-tiers',
    id: String(tierId),
    overrideAccess: true,
    depth: 0,
  })

  if (!tier) {
    return NextResponse.json({ error: 'Tier not found' }, { status: 404 })
  }

  // Ownership check — compare resolved tier tenant to request tenant
  // The tenant field may be a number ID (depth: 0) or a populated object
  const tierTenantId =
    typeof (tier as any).tenant === 'object' && (tier as any).tenant !== null
      ? String((tier as any).tenant.id)
      : String((tier as any).tenant)

  if (tierTenantId !== String(tenant.id)) {
    return NextResponse.json({ error: 'Tier not found' }, { status: 404 })
  }

  try {
    // Use the request Origin header; fall back to the canonical tenant subdomain
    const origin =
      req.headers.get('origin') ?? `https://${(tenant as any).slug ?? ''}.openmasjid.app`

    // Build Checkout session params (validates tenant Connect + tier active + synced)
    const args = buildCheckoutSessionArgs(tier as any, tenant as any, origin)

    // Resolve stripeAccountId from either flat or nested donationConfig shape
    const tenantAny = tenant as any
    const stripeAccountId: string =
      tenantAny.stripeAccountId ??
      tenantAny.donationConfig?.stripeAccountId

    const stripe = stripeForAccount(stripeAccountId)
    const session = await stripe.checkout.sessions.create(args, {
      stripeAccount: stripeAccountId,
    })

    // 303 See Other — redirects the browser to the Stripe-hosted checkout page
    return NextResponse.redirect(session.url!, 303)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Checkout failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
