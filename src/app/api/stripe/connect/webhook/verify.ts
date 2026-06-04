import type Stripe from 'stripe'
import { getStripe, getStripeTest } from '@/lib/stripe'

export interface VerifiedConnectEvent {
  event: Stripe.Event & { account?: string }
  mode: 'live' | 'test'
  stripe: Stripe
}

/**
 * Verify a Connect webhook against both the live and test signing secrets.
 * Returns the parsed event plus the mode-correct Stripe client, or null if
 * neither secret validates the signature. Clients are only constructed for
 * secrets that are present, so an unset test key never throws here.
 */
export function verifyConnectEvent(
  raw: string,
  sig: string,
  secrets: { liveSecret?: string; testSecret?: string },
): VerifiedConnectEvent | null {
  const candidates: Array<{ secret: string; mode: 'live' | 'test'; stripe: Stripe }> = []
  if (secrets.liveSecret) candidates.push({ secret: secrets.liveSecret, mode: 'live', stripe: getStripe() })
  if (secrets.testSecret) candidates.push({ secret: secrets.testSecret, mode: 'test', stripe: getStripeTest() })

  for (const c of candidates) {
    try {
      const event = c.stripe.webhooks.constructEvent(raw, sig, c.secret) as Stripe.Event & {
        account?: string
      }
      return { event, mode: c.mode, stripe: c.stripe }
    } catch {
      // signature didn't match this secret; try the next
    }
  }
  return null
}
