import { describe, it, expect } from 'vitest'
import { mapStripeEventToDonationAction } from '@/lib/donations-webhook'

describe('mapStripeEventToDonationAction', () => {
  it('maps checkout.session.completed in payment mode to recordDonation (one_time)', async () => {
    const action = await mapStripeEventToDonationAction({
      account: 'acct_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          payment_intent: 'pi_1',
          amount_total: 5000,
          currency: 'usd',
          metadata: { tenantId: 't_1', fundId: 'f_1', frequency: 'one_time' },
        },
      },
    } as any)

    expect(action).toEqual({
      kind: 'recordDonation',
      tenantId: 't_1',
      fundId: 'f_1',
      frequency: 'one_time',
      amountCents: 5000,
      currency: 'usd',
      status: 'succeeded',
      stripePaymentIntentId: 'pi_1',
      stripeAccountId: 'acct_123',
    })
  })

  it('maps checkout.session.completed in subscription mode to recordDonation (monthly)', async () => {
    const action = await mapStripeEventToDonationAction({
      account: 'acct_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          payment_intent: 'pi_2',
          subscription: 'sub_1',
          amount_total: 2500,
          currency: 'usd',
          metadata: { tenantId: 't_1', fundId: 'f_1', frequency: 'monthly' },
        },
      },
    } as any)

    expect(action).toEqual({
      kind: 'recordDonation',
      tenantId: 't_1',
      fundId: 'f_1',
      frequency: 'monthly',
      amountCents: 2500,
      currency: 'usd',
      status: 'succeeded',
      stripePaymentIntentId: 'pi_2',
      stripeSubscriptionId: 'sub_1',
      stripeAccountId: 'acct_123',
    })
  })

  it('returns null for the very first invoice (subscription_create) — deduped by checkout.session.completed', async () => {
    const action = await mapStripeEventToDonationAction(
      {
        account: 'acct_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            billing_reason: 'subscription_create',
            subscription: 'sub_1',
            payment_intent: 'pi_x',
            amount_paid: 2500,
            currency: 'usd',
          },
        },
      } as any,
      async () => ({ tenantId: 't_1', fundId: 'f_1', frequency: 'monthly' }),
    )
    expect(action).toBeNull()
  })

  it('maps invoice.payment_succeeded (renewal) to recordDonation, resolving metadata via injected resolver', async () => {
    const calls: Array<[string, string]> = []
    const action = await mapStripeEventToDonationAction(
      {
        account: 'acct_123',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            billing_reason: 'subscription_cycle',
            subscription: 'sub_1',
            payment_intent: 'pi_renew_1',
            amount_paid: 2500,
            currency: 'usd',
          },
        },
      } as any,
      async (subId, acctId) => {
        calls.push([subId, acctId])
        return { tenantId: 't_1', fundId: 'f_1', frequency: 'monthly' }
      },
    )

    expect(calls).toEqual([['sub_1', 'acct_123']])
    expect(action).toEqual({
      kind: 'recordDonation',
      tenantId: 't_1',
      fundId: 'f_1',
      frequency: 'monthly',
      amountCents: 2500,
      currency: 'usd',
      status: 'succeeded',
      stripePaymentIntentId: 'pi_renew_1',
      stripeSubscriptionId: 'sub_1',
      stripeAccountId: 'acct_123',
    })
  })

  it('maps charge.refunded to refundDonation', async () => {
    const action = await mapStripeEventToDonationAction({
      account: 'acct_123',
      type: 'charge.refunded',
      data: { object: { id: 'ch_1' } },
    } as any)

    expect(action).toEqual({ kind: 'refundDonation', stripeChargeId: 'ch_1' })
  })

  it('maps account.updated to syncAccount', async () => {
    const action = await mapStripeEventToDonationAction({
      account: 'acct_123',
      type: 'account.updated',
      data: {
        object: { id: 'acct_123', charges_enabled: true, payouts_enabled: false },
      },
    } as any)

    expect(action).toEqual({
      kind: 'syncAccount',
      stripeAccountId: 'acct_123',
      chargesEnabled: true,
      payoutsEnabled: false,
    })
  })

  it('returns null for unhandled event types', async () => {
    const action = await mapStripeEventToDonationAction({
      account: 'acct_123',
      type: 'customer.created',
      data: { object: {} },
    } as any)
    expect(action).toBeNull()
  })
})
