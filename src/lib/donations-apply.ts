import type { Payload } from 'payload'
import type { DonationAction } from './donations-webhook'
import { relationshipId, tenantIdForConnectedAccount } from './stripe-connect-binding'

export async function applyDonationAction(
  payload: Payload,
  action: DonationAction,
): Promise<void> {
  switch (action.kind) {
    case 'recordDonation': {
      // Idempotent insert keyed by stripePaymentIntentId.
      const existing = await payload.find({
        collection: 'donations',
        where: { stripePaymentIntentId: { equals: action.stripePaymentIntentId } },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return

      // --- Connect attribution binding (CWE-639) ---
      // Attribute the donation by the connected account that produced the
      // event (action.stripeAccountId === event.account), never by the
      // attacker-controllable metadata tenant/fund ids. We require that:
      //   1. some tenant has this connected account configured,
      //   2. the metadata tenantId matches that account owner, and
      //   3. the fund belongs to that tenant.
      // Any mismatch → drop the write (ack the event so Stripe stops retrying).
      const tenantId = await tenantIdForConnectedAccount(payload, action.stripeAccountId)
      if (tenantId === null) {
        payload.logger?.warn?.(
          `donations-apply: no tenant owns connected account ${action.stripeAccountId}; dropping donation`,
        )
        return
      }
      const metaTenantId = Number(action.tenantId)
      if (!Number.isFinite(metaTenantId) || metaTenantId !== tenantId) {
        payload.logger?.warn?.(
          `donations-apply: metadata tenant ${action.tenantId} does not match account owner ${tenantId}; dropping donation`,
        )
        return
      }
      const fundId = Number(action.fundId)
      if (!Number.isFinite(fundId)) return
      const funds = await payload.find({
        collection: 'donation-funds',
        where: { id: { equals: fundId } },
        limit: 1,
        overrideAccess: true,
      })
      const fund = funds.docs[0]
      if (!fund || relationshipId((fund as { tenant?: unknown }).tenant) !== tenantId) {
        payload.logger?.warn?.(
          `donations-apply: fund ${action.fundId} does not belong to tenant ${tenantId}; dropping donation`,
        )
        return
      }

      await payload.create({
        collection: 'donations',
        data: {
          tenant: tenantId,
          fund: fundId,
          amount: action.amountCents,
          currency: action.currency,
          frequency: action.frequency,
          status: 'succeeded',
          stripePaymentIntentId: action.stripePaymentIntentId,
          stripeChargeId: action.stripeChargeId,
          stripeSubscriptionId: action.stripeSubscriptionId,
          stripeAccountId: action.stripeAccountId,
        },
        overrideAccess: true,
      })
      return
    }

    case 'refundDonation': {
      const found = await payload.find({
        collection: 'donations',
        where: { stripeChargeId: { equals: action.stripeChargeId } },
        limit: 1,
        overrideAccess: true,
      })
      const doc = found.docs[0]
      if (!doc) return
      await payload.update({
        collection: 'donations',
        id: doc.id,
        data: { status: 'refunded' },
        overrideAccess: true,
      })
      return
    }

    case 'syncAccount': {
      const found = await payload.find({
        collection: 'tenants',
        where: {
          'donationConfig.stripeAccountId': { equals: action.stripeAccountId },
        },
        limit: 1,
        overrideAccess: true,
      })
      const tenant = found.docs[0]
      if (!tenant) return
      await payload.update({
        collection: 'tenants',
        id: tenant.id,
        overrideAccess: true,
        data: {
          donationConfig: {
            stripeChargesEnabled: action.chargesEnabled,
            stripePayoutsEnabled: action.payoutsEnabled,
            stripeAccountLastSyncedAt: new Date().toISOString(),
          },
        },
      })
      return
    }
  }
}
