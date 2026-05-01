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
        collection: 'donations',
        where: { stripePaymentIntentId: { equals: action.stripePaymentIntentId } },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return
      await payload.create({
        collection: 'donations',
        data: {
          // Payload's generated types narrow tenant/fund to `number | Tenant`,
          // but action ids arrive as strings (Stripe metadata) and Payload
          // accepts string ids in practice — cast just the relation fields.
          tenant: action.tenantId as unknown as number,
          fund: action.fundId as unknown as number,
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
