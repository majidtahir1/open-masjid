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
