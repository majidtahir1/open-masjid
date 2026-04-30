import type Stripe from 'stripe'
import type { TenantStatus } from './billing'

export interface TenantUpdate {
  stripeCustomerId: string
  data: {
    status?: TenantStatus
    stripeSubscriptionId?: string | null
    currentPeriodEnd?: string | null
    gracePeriodEndsAt?: string | null
  }
  /**
   * Stripe price id for the active subscription item, when the event carries
   * one. The route translates this against STRIPE_PRICE_MONTHLY / _ANNUAL to
   * write `subscriptionPlan` on the tenant — kept out of `data` so the mapper
   * stays pure (no env reads).
   */
  priceId?: string | null
}

const GRACE_DAYS = 30

function customerIdOf(c: unknown): string | null {
  if (typeof c === 'string') return c
  if (c && typeof c === 'object' && 'id' in c && typeof (c as { id: unknown }).id === 'string') {
    return (c as { id: string }).id
  }
  return null
}

type PriceLike = { id?: string } | string | null | undefined
function priceIdOf(p: PriceLike): string | null {
  if (typeof p === 'string') return p
  if (p && typeof p === 'object' && typeof p.id === 'string') return p.id
  return null
}

export function mapStripeEventToTenantUpdate(event: Stripe.Event): TenantUpdate | null {
  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as unknown as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null
      }
      const customer = customerIdOf(inv.customer)
      if (!customer) return null
      const subscription =
        typeof inv.subscription === 'string'
          ? inv.subscription
          : (inv.subscription?.id ?? null)
      const line = inv.lines?.data?.[0] as
        | { period?: { end?: number }; price?: PriceLike }
        | undefined
      const periodEnd = line?.period?.end
      return {
        stripeCustomerId: customer,
        data: {
          status: 'active',
          stripeSubscriptionId: subscription,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          gracePeriodEndsAt: null,
        },
        priceId: priceIdOf(line?.price),
      }
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as unknown as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null
      }
      const customer = customerIdOf(inv.customer)
      if (!customer) return null
      const subscription =
        typeof inv.subscription === 'string'
          ? inv.subscription
          : (inv.subscription?.id ?? null)
      return {
        stripeCustomerId: customer,
        data: { status: 'past_due', stripeSubscriptionId: subscription },
      }
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as unknown as Stripe.Subscription & {
        items?: { data?: Array<{ price?: PriceLike }> }
      }
      const customer = customerIdOf(sub.customer)
      if (!customer) return null
      const grace = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      return {
        stripeCustomerId: customer,
        data: { status: 'canceled', stripeSubscriptionId: sub.id, gracePeriodEndsAt: grace },
        priceId: priceIdOf(sub.items?.data?.[0]?.price),
      }
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as unknown as Stripe.Subscription & {
        current_period_end?: number
        cancel_at_period_end?: boolean
        cancel_at?: number | null
        items?: { data?: Array<{ price?: PriceLike }> }
      }
      const customer = customerIdOf(sub.customer)
      if (!customer) return null
      const periodEndIso = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null
      // Stripe Customer Portal "Cancel" defaults to cancel-at-period-end:
      // sub.status stays 'active' until the period actually ends, but
      // cancel_at_period_end flips to true and cancel_at carries the date.
      // Treat this as canceled now so the admin sees the right state, with
      // grace period running until the access actually ends.
      if (sub.cancel_at_period_end) {
        const cancelAt = sub.cancel_at ?? sub.current_period_end
        return {
          stripeCustomerId: customer,
          data: {
            status: 'canceled',
            stripeSubscriptionId: sub.id,
            currentPeriodEnd: periodEndIso,
            gracePeriodEndsAt: cancelAt
              ? new Date(cancelAt * 1000).toISOString()
              : new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          },
          priceId: priceIdOf(sub.items?.data?.[0]?.price),
        }
      }
      const map: Record<string, TenantStatus | undefined> = {
        active: 'active',
        trialing: 'trialing',
        past_due: 'past_due',
        canceled: 'canceled',
        unpaid: 'past_due',
      }
      const status = map[sub.status]
      if (!status) return null
      return {
        stripeCustomerId: customer,
        data: {
          status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: periodEndIso,
          // Reactivation: if the user un-cancels in the portal, clear grace.
          gracePeriodEndsAt: status === 'active' ? null : undefined,
        },
        priceId: priceIdOf(sub.items?.data?.[0]?.price),
      }
    }
    default:
      return null
  }
}
