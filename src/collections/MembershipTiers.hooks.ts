// src/collections/MembershipTiers.hooks.ts
import type { CollectionAfterChangeHook } from 'payload'
import type { Tenant } from '@/payload-types'
import { stripeForAccount } from '@/lib/stripe-connect'
import { ensureStripeProductAndPrice, archiveTierInStripe } from '@/lib/membership-stripe'

interface TierDoc {
  id: number | string
  tenant: number | string | { id: number | string }
  name: string
  amountCents: number
  cadence: 'monthly' | 'yearly'
  active: boolean
  stripeProductId: string | null
  stripePriceId: string | null
  archivedPriceIds: { priceId: string }[] | null
}

/** Narrow helper — resolves `stripeAccountId` / `stripeChargesEnabled` from the
 *  Tenant row regardless of how the donation config stores them. The real Tenant
 *  type keeps these under `donationConfig`; the test mock flattens them for
 *  convenience, so we accept either shape via `unknown` cast. */
function getTenantStripeInfo(tenant: unknown): { stripeAccountId: string | null; stripeChargesEnabled: boolean } {
  const t = tenant as Tenant & { stripeAccountId?: string | null; stripeChargesEnabled?: boolean | null }
  // Flattened shape (used by tests / future membership-specific connect flow)
  if (t.stripeAccountId !== undefined) {
    return {
      stripeAccountId: t.stripeAccountId ?? null,
      stripeChargesEnabled: t.stripeChargesEnabled === true,
    }
  }
  // Real Payload Tenant shape: donationConfig holds the Connect fields
  const dc = (t as Tenant).donationConfig
  return {
    stripeAccountId: dc?.stripeAccountId ?? null,
    stripeChargesEnabled: dc?.stripeChargesEnabled === true,
  }
}

export const syncTierAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const tier = doc as TierDoc
  const prev = previousDoc as TierDoc | null
  const tenantId = typeof tier.tenant === 'object' ? tier.tenant.id : tier.tenant

  let updates: Record<string, unknown> = {}
  try {
    const tenant = await req.payload.findByID({ collection: 'tenants', id: tenantId })
    const { stripeAccountId, stripeChargesEnabled } = getTenantStripeInfo(tenant)

    if (!stripeAccountId || !stripeChargesEnabled) {
      throw new Error('Stripe Connect not enabled for this tenant. Cannot sync tier to Stripe.')
    }
    const stripe = stripeForAccount(stripeAccountId)

    // Soft-delete path: active flipped false → archive everything in Stripe
    if (operation === 'update' && prev?.active === true && tier.active === false) {
      await archiveTierInStripe(
        { ...tier, tenant: { id: tenantId, stripeAccountId } },
        stripe,
        stripeAccountId,
      )
      updates = { lastStripeSyncAt: new Date().toISOString(), lastStripeSyncError: null }
    } else {
      // Detect amount or cadence change → rotate Price
      const amountChanged = prev != null && prev.amountCents !== tier.amountCents
      const cadenceChanged = prev != null && prev.cadence !== tier.cadence
      const archived = (tier.archivedPriceIds ?? []).slice()
      let priceIdForHelper = tier.stripePriceId

      if ((amountChanged || cadenceChanged) && tier.stripePriceId) {
        // Archive the old Price; clear stripePriceId so the helper creates a fresh one
        await stripe.prices.update(
          tier.stripePriceId,
          { active: false },
          { stripeAccount: stripeAccountId },
        )
        archived.push({ priceId: tier.stripePriceId })
        priceIdForHelper = null
      }

      const result = await ensureStripeProductAndPrice(
        {
          ...tier,
          stripePriceId: priceIdForHelper,
          archivedPriceIds: archived,
          tenant: { id: tenantId, stripeAccountId },
        },
        stripe,
        stripeAccountId,
      )
      updates = {
        stripeProductId: result.stripeProductId,
        stripePriceId: result.stripePriceId,
        archivedPriceIds: archived,
        lastStripeSyncAt: new Date().toISOString(),
        lastStripeSyncError: null,
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Stripe sync error'
    updates = { lastStripeSyncError: msg, lastStripeSyncAt: new Date().toISOString() }
  }

  // Persist sync state without re-firing this hook (guard via context).
  // Pass `req` so this update runs in the same transaction as the parent
  // create/update — otherwise it opens a new transaction that can't see the
  // just-inserted row and Payload returns 404 to the caller.
  await req.payload.update({
    collection: 'membership-tiers',
    id: tier.id,
    data: updates,
    overrideAccess: true,
    context: { skipMembershipSync: true },
    req,
  })
}
