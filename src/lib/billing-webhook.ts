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
}

const GRACE_DAYS = 30

export function mapStripeEventToTenantUpdate(event: Stripe.Event): TenantUpdate | null {
  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as unknown as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null
      }
      const customer = inv.customer as string
      const subscription =
        typeof inv.subscription === 'string'
          ? inv.subscription
          : (inv.subscription?.id ?? null)
      const periodEnd = inv.lines?.data?.[0]?.period?.end
      return {
        stripeCustomerId: customer,
        data: {
          status: 'active',
          stripeSubscriptionId: subscription,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          gracePeriodEndsAt: null,
        },
      }
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as unknown as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null
      }
      const subscription =
        typeof inv.subscription === 'string'
          ? inv.subscription
          : (inv.subscription?.id ?? null)
      return {
        stripeCustomerId: inv.customer as string,
        data: { status: 'past_due', stripeSubscriptionId: subscription },
      }
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as unknown as Stripe.Subscription
      const grace = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      return {
        stripeCustomerId: sub.customer as string,
        data: { status: 'canceled', stripeSubscriptionId: sub.id, gracePeriodEndsAt: grace },
      }
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as unknown as Stripe.Subscription & {
        current_period_end?: number
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
        stripeCustomerId: sub.customer as string,
        data: {
          status,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        },
      }
    }
    default:
      return null
  }
}
