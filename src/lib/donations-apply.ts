import type { Payload } from 'payload'
import type { DonationAction } from './donations-webhook'

export async function applyDonationAction(
  payload: Payload,
  action: DonationAction,
): Promise<void> {
  switch (action.kind) {
    case 'recordDonation': {
      // Idempotent insert keyed by stripePaymentIntentId.
      const existing = await payload.find({
        collection: 'donations' as never,
        where: { stripePaymentIntentId: { equals: action.stripePaymentIntentId } },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return
      await payload.create({
        collection: 'donations' as never,
        data: {
          tenant: action.tenantId,
          fund: action.fundId,
          amount: action.amountCents,
          currency: action.currency,
          frequency: action.frequency,
          status: 'succeeded',
          stripePaymentIntentId: action.stripePaymentIntentId,
          stripeChargeId: action.stripeChargeId,
          stripeSubscriptionId: action.stripeSubscriptionId,
          stripeAccountId: action.stripeAccountId,
        } as never,
        overrideAccess: true,
      })
      return
    }

    case 'refundDonation': {
      const found = await payload.find({
        collection: 'donations' as never,
        where: { stripeChargeId: { equals: action.stripeChargeId } },
        limit: 1,
        overrideAccess: true,
      })
      const doc = found.docs[0] as { id: string } | undefined
      if (!doc) return
      await payload.update({
        collection: 'donations' as never,
        id: doc.id,
        data: { status: 'refunded' } as never,
        overrideAccess: true,
      })
      return
    }

    case 'syncAccount': {
      const found = await payload.find({
        collection: 'tenants' as never,
        where: {
          'donationConfig.stripeAccountId': { equals: action.stripeAccountId },
        },
        limit: 1,
        overrideAccess: true,
      })
      const tenant = found.docs[0] as { id: string } | undefined
      if (!tenant) return
      await payload.update({
        collection: 'tenants' as never,
        id: tenant.id,
        overrideAccess: true,
        data: {
          donationConfig: {
            stripeChargesEnabled: action.chargesEnabled,
            stripePayoutsEnabled: action.payoutsEnabled,
            stripeAccountLastSyncedAt: new Date().toISOString(),
          },
        } as never,
      })
      return
    }
  }
}
