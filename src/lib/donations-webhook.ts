import type Stripe from 'stripe'

export type DonationAction = { kind: 'noop' }

export function mapStripeEventToDonationAction(
  _event: Stripe.Event,
): DonationAction | null {
  return null
}
