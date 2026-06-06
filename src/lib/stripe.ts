import Stripe from 'stripe'

const API_VERSION = '2025-02-24.acacia' as const

let cachedLive: Stripe | null = null
let cachedTest: Stripe | null = null

export function getStripe(): Stripe {
  if (cachedLive) return cachedLive
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  cachedLive = new Stripe(key, { apiVersion: API_VERSION })
  return cachedLive
}

export function getStripeTest(): Stripe {
  if (cachedTest) return cachedTest
  const key = process.env.STRIPE_SECRET_KEY_TEST
  if (!key) throw new Error('STRIPE_SECRET_KEY_TEST is not set')
  cachedTest = new Stripe(key, { apiVersion: API_VERSION })
  return cachedTest
}

/** Connect calls route here: demo tenants use the TEST platform key, all
 *  others the live key. The mode follows the platform key (Stripe forbids
 *  mixing a live key with a test connected account and vice-versa). */
export function getStripeForTenant(
  tenant: { demoMode?: boolean | null } | null | undefined,
): Stripe {
  return tenant?.demoMode ? getStripeTest() : getStripe()
}

/** Resolve a tenant's connected Stripe account id. The Connect OAuth callback
 *  stores it nested under `donationConfig`; tolerate a flat shape too. Returns
 *  null when no account is connected. */
export function connectedAccountId(
  tenant:
    | { stripeAccountId?: string | null; donationConfig?: { stripeAccountId?: string | null } | null }
    | null
    | undefined,
): string | null {
  const id = tenant?.donationConfig?.stripeAccountId ?? tenant?.stripeAccountId
  return typeof id === 'string' && id.length > 0 ? id : null
}

/** Test-only: clear cached clients so env changes take effect. */
export function __resetStripeCache(): void {
  cachedLive = null
  cachedTest = null
}

export function getPriceId(plan: 'monthly' | 'annual'): string {
  const id = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_ANNUAL
  if (!id) throw new Error(`Missing Stripe price env var for plan=${plan}`)
  return id
}
