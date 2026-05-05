/**
 * Pure helper for building Stripe Checkout session parameters for a membership
 * subscription. Separated from the route handler for testability.
 *
 * Validation order:
 *   1. Tenant Stripe Connect live (stripeChargesEnabled)
 *   2. Tier active
 *   3. Tier synced to Stripe (has a stripePriceId)
 */
import type Stripe from 'stripe'

/** Narrow helper — resolves stripeChargesEnabled from either the flat shape
 *  (test mocks / future membership-specific connect) or the real Payload Tenant
 *  shape where these fields live under `donationConfig`. */
function getTenantConnectInfo(tenant: unknown): {
  stripeAccountId: string | null
  stripeChargesEnabled: boolean
} {
  const t = tenant as {
    stripeAccountId?: string | null
    stripeChargesEnabled?: boolean | null
    donationConfig?: {
      stripeAccountId?: string | null
      stripeChargesEnabled?: boolean | null
    }
  }

  // Flat shape (test mocks or flattened tenant)
  if (t.stripeChargesEnabled !== undefined || t.stripeAccountId !== undefined) {
    return {
      stripeAccountId: t.stripeAccountId ?? null,
      stripeChargesEnabled: t.stripeChargesEnabled === true,
    }
  }

  // Real Payload Tenant shape: donationConfig holds the Connect fields
  const dc = t.donationConfig
  return {
    stripeAccountId: dc?.stripeAccountId ?? null,
    stripeChargesEnabled: dc?.stripeChargesEnabled === true,
  }
}

export function buildCheckoutSessionArgs(
  tier: { id: string | number; name?: string; stripePriceId?: string | null; active: boolean },
  tenant: { id: string | number; slug?: string } & Record<string, unknown>,
  origin: string,
): Stripe.Checkout.SessionCreateParams {
  // 1. Validate tenant Connect is live (duck-type both flat and nested shapes)
  const { stripeChargesEnabled } = getTenantConnectInfo(tenant)
  if (!stripeChargesEnabled) {
    throw new Error('Stripe Connect not enabled for this tenant')
  }

  // 2. Validate tier is active
  if (!tier.active) {
    throw new Error('Tier is not active')
  }

  // 3. Validate tier is synced to Stripe
  if (!tier.stripePriceId) {
    throw new Error('Tier is not synced to Stripe (missing stripePriceId)')
  }

  const tenantId = String(tenant.id)
  const tierId = String(tier.id)
  const sharedMetadata = { kind: 'membership', tenantId, tierId }

  // Note: in `mode: 'subscription'` Stripe always creates a Customer for the
  // session — passing `customer_creation` is rejected with
  // "`customer_creation` can only be used in `payment` mode."
  return {
    mode: 'subscription',
    line_items: [{ price: tier.stripePriceId, quantity: 1 }],
    success_url: `${origin}/membership/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/membership`,
    metadata: sharedMetadata,
    subscription_data: {
      metadata: sharedMetadata,
    },
  }
}
