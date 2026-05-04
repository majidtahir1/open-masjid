import type Stripe from 'stripe'

export interface TierLike {
  id: string | number
  name: string
  amountCents: number
  cadence: 'monthly' | 'yearly'
  stripeProductId?: string | null
  stripePriceId?: string | null
  archivedPriceIds?: { priceId: string }[] | null
  tenant: { id: string | number; stripeAccountId?: string | null }
}

export interface SyncResult {
  stripeProductId: string
  stripePriceId: string
  archivedPriceIds: { priceId: string }[]
}

/**
 * Pure-ish: caller owns the rotation decision.
 *
 *   - Creates Product if `stripeProductId` is null.
 *   - Updates Product name (and re-activates) if `stripeProductId` is set.
 *   - Creates a Price if `stripePriceId` is null, using current
 *     `amountCents` + `cadence`.
 *   - **Never archives** Prices. The hook (`syncTierAfterChange`) detects
 *     amount/cadence changes, archives the old Price, pushes its id into
 *     `archivedPriceIds`, then clears `stripePriceId` to null and calls
 *     this helper to create the replacement.
 *
 * Idempotent under repeat calls with the same input.
 */
export async function ensureStripeProductAndPrice(
  tier: TierLike,
  stripe: Stripe,
  stripeAccount: string,
): Promise<SyncResult> {
  const archived = (tier.archivedPriceIds ?? []).slice()
  const interval = tier.cadence === 'yearly' ? 'year' : 'month'

  let productId = tier.stripeProductId ?? null
  if (!productId) {
    const product = await stripe.products.create(
      {
        name: tier.name,
        metadata: { kind: 'membership', tierId: String(tier.id), tenantId: String(tier.tenant.id) },
      },
      { stripeAccount },
    )
    productId = product.id
  } else {
    await stripe.products.update(
      productId,
      { name: tier.name, active: true },
      { stripeAccount },
    )
  }

  let priceId = tier.stripePriceId ?? null
  if (!priceId) {
    const price = await stripe.prices.create(
      {
        product: productId,
        unit_amount: tier.amountCents,
        currency: 'usd',
        recurring: { interval },
        metadata: { kind: 'membership', tierId: String(tier.id), tenantId: String(tier.tenant.id) },
      },
      { stripeAccount },
    )
    priceId = price.id
  }

  return { stripeProductId: productId, stripePriceId: priceId, archivedPriceIds: archived }
}

/**
 * Soft-delete: archive the current Price and the Product. Existing
 * subscribers keep billing; new checkouts cannot start. Idempotent.
 */
export async function archiveTierInStripe(
  tier: TierLike,
  stripe: Stripe,
  stripeAccount: string,
): Promise<void> {
  if (tier.stripePriceId) {
    await stripe.prices.update(tier.stripePriceId, { active: false }, { stripeAccount })
  }
  if (tier.stripeProductId) {
    await stripe.products.update(tier.stripeProductId, { active: false }, { stripeAccount })
  }
}
