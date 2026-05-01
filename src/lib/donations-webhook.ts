import type Stripe from 'stripe'

export type DonationAction =
  | {
      kind: 'recordDonation'
      tenantId: string
      fundId: string
      frequency: 'one_time' | 'monthly'
      amountCents: number
      currency: string
      status: 'succeeded'
      stripePaymentIntentId: string
      stripeChargeId?: string
      stripeSubscriptionId?: string
      stripeAccountId: string
    }
  | { kind: 'refundDonation'; stripeChargeId: string }
  | {
      kind: 'syncAccount'
      stripeAccountId: string
      chargesEnabled: boolean
      payoutsEnabled: boolean
    }

function idOf(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && 'id' in v && typeof (v as { id: unknown }).id === 'string') {
    return (v as { id: string }).id
  }
  return null
}

export async function mapStripeEventToDonationAction(
  event: Stripe.Event,
  resolveSubscriptionMetadata?: (
    subId: string,
    acctId: string,
  ) => Promise<Record<string, string>>,
): Promise<DonationAction | null> {
  const acctId = (event as Stripe.Event & { account?: string }).account
  switch (event.type) {
    case 'checkout.session.completed': {
      if (!acctId) return null
      const session = event.data.object as unknown as Stripe.Checkout.Session
      const metadata = (session.metadata ?? {}) as Record<string, string>
      const tenantId = metadata.tenantId
      const fundId = metadata.fundId
      if (!tenantId || !fundId) return null

      const amountCents = session.amount_total
      const currency = session.currency
      if (typeof amountCents !== 'number' || !currency) return null

      const piId = idOf(session.payment_intent)
      const isSubscription = session.mode === 'subscription'
      const frequency: 'one_time' | 'monthly' = isSubscription ? 'monthly' : 'one_time'
      const subId = isSubscription ? idOf(session.subscription) : null

      if (!piId) return null

      const action: DonationAction = {
        kind: 'recordDonation',
        tenantId,
        fundId,
        frequency,
        amountCents,
        currency,
        status: 'succeeded',
        stripePaymentIntentId: piId,
        stripeAccountId: acctId,
      }
      if (subId) (action as { stripeSubscriptionId?: string }).stripeSubscriptionId = subId
      return action
    }

    case 'invoice.payment_succeeded': {
      if (!acctId) return null
      const invoice = event.data.object as unknown as Stripe.Invoice & {
        billing_reason?: string
        subscription?: string | Stripe.Subscription | null
        payment_intent?: string | Stripe.PaymentIntent | null
        amount_paid?: number
      }
      // Skip the very first invoice — it's covered by checkout.session.completed.
      if (invoice.billing_reason === 'subscription_create') return null

      const subId = idOf(invoice.subscription)
      const piId = idOf(invoice.payment_intent)
      const amountCents = invoice.amount_paid
      const currency = invoice.currency
      if (!subId || !piId || typeof amountCents !== 'number' || !currency) return null
      if (!resolveSubscriptionMetadata) return null

      const metadata = await resolveSubscriptionMetadata(subId, acctId)
      const tenantId = metadata?.tenantId
      const fundId = metadata?.fundId
      if (!tenantId || !fundId) return null

      return {
        kind: 'recordDonation',
        tenantId,
        fundId,
        frequency: 'monthly',
        amountCents,
        currency,
        status: 'succeeded',
        stripePaymentIntentId: piId,
        stripeSubscriptionId: subId,
        stripeAccountId: acctId,
      }
    }

    case 'charge.refunded': {
      const charge = event.data.object as unknown as Stripe.Charge
      if (!charge.id) return null
      return { kind: 'refundDonation', stripeChargeId: charge.id }
    }

    case 'account.updated': {
      if (!acctId) return null
      const account = event.data.object as unknown as Stripe.Account
      return {
        kind: 'syncAccount',
        stripeAccountId: acctId,
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
      }
    }

    default:
      return null
  }
}
