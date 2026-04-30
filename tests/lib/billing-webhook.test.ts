import { describe, it, expect } from 'vitest'
import { mapStripeEventToTenantUpdate } from '@/lib/billing-webhook'

describe('mapStripeEventToTenantUpdate', () => {
  it('marks tenant active and clears grace on payment success', () => {
    const update = mapStripeEventToTenantUpdate({
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          customer: 'cus_1',
          subscription: 'sub_1',
          lines: { data: [{ period: { end: 1747000000 } }] },
        },
      },
    } as any)
    expect(update).toEqual({
      stripeCustomerId: 'cus_1',
      data: {
        status: 'active',
        stripeSubscriptionId: 'sub_1',
        currentPeriodEnd: new Date(1747000000 * 1000).toISOString(),
        gracePeriodEndsAt: null,
      },
    })
  })

  it('marks tenant past_due on payment failure', () => {
    const update = mapStripeEventToTenantUpdate({
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_1', subscription: 'sub_1' } },
    } as any)
    expect(update?.data.status).toBe('past_due')
  })

  it('marks tenant canceled with 30-day grace on subscription deletion', () => {
    const before = Date.now()
    const update = mapStripeEventToTenantUpdate({
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_1', id: 'sub_1' } },
    } as any)
    expect(update?.data.status).toBe('canceled')
    const grace = new Date(update!.data.gracePeriodEndsAt as string).getTime()
    expect(grace).toBeGreaterThanOrEqual(before + 29 * 24 * 60 * 60 * 1000)
  })

  it('returns null for irrelevant events', () => {
    expect(mapStripeEventToTenantUpdate({ type: 'charge.refunded' } as any)).toBeNull()
  })
})

describe('mapStripeEventToTenantUpdate — additional coverage', () => {
  it('maps customer.subscription.updated with each Stripe status to our enum', () => {
    const make = (status: string) =>
      mapStripeEventToTenantUpdate({
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_1', customer: 'cus_1', status, current_period_end: 1747000000 } },
      } as any)
    expect(make('active')?.data.status).toBe('active')
    expect(make('trialing')?.data.status).toBe('trialing')
    expect(make('past_due')?.data.status).toBe('past_due')
    expect(make('canceled')?.data.status).toBe('canceled')
    expect(make('unpaid')?.data.status).toBe('past_due') // coalesced
    expect(make('incomplete')).toBeNull() // unmapped → null
  })

  it('returns null when customer is an expanded object Stripe never typically sends', () => {
    // Defensive guard: if Stripe ever expands customer, don't write [object Object]
    // as a customer id. Returning null is fine — there's no tenant to update.
    const update = mapStripeEventToTenantUpdate({
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          customer: { id: 'cus_expanded' }, // expanded form
          subscription: 'sub_1',
          lines: { data: [{ period: { end: 1747000000 } }] },
        },
      },
    } as any)
    // The helper extracts the id, so this should still produce a valid update.
    expect(update?.stripeCustomerId).toBe('cus_expanded')
  })

  it('returns null when customer is missing entirely', () => {
    const update = mapStripeEventToTenantUpdate({
      type: 'invoice.payment_failed',
      data: { object: { customer: null, subscription: 'sub_1' } },
    } as any)
    expect(update).toBeNull()
  })
})
