import { describe, it, expect, beforeEach } from 'vitest'
import Stripe from 'stripe'
import { verifyConnectEvent } from '@/app/api/stripe/connect/webhook/verify'
import { __resetStripeCache } from '@/lib/stripe'

function sign(secret: string, payload: object): { raw: string; sig: string } {
  const raw = JSON.stringify(payload)
  const header = Stripe.webhooks.generateTestHeaderString({ payload: raw, secret })
  return { raw, sig: header }
}

describe('verifyConnectEvent', () => {
  const live = 'whsec_live_dummy'
  const test = 'whsec_test_dummy'

  beforeEach(() => {
    // verifyConnectEvent constructs real Stripe clients, which need keys set.
    process.env.STRIPE_SECRET_KEY = 'sk_live_dummy'
    process.env.STRIPE_SECRET_KEY_TEST = 'sk_test_dummy'
    __resetStripeCache()
  })

  it('accepts an event signed with the live secret and reports live mode', () => {
    const { raw, sig } = sign(live, { id: 'evt_1', type: 'ping', livemode: true })
    const r = verifyConnectEvent(raw, sig, { liveSecret: live, testSecret: test })
    expect(r?.mode).toBe('live')
    expect(r?.event.id).toBe('evt_1')
  })

  it('accepts an event signed with the test secret and reports test mode', () => {
    const { raw, sig } = sign(test, { id: 'evt_2', type: 'ping', livemode: false })
    const r = verifyConnectEvent(raw, sig, { liveSecret: live, testSecret: test })
    expect(r?.mode).toBe('test')
  })

  it('rejects an event signed with an unknown secret', () => {
    const { raw, sig } = sign('whsec_bogus', { id: 'evt_3', type: 'ping' })
    expect(verifyConnectEvent(raw, sig, { liveSecret: live, testSecret: test })).toBeNull()
  })

  it('skips the test secret when it is unset', () => {
    const { raw, sig } = sign(live, { id: 'evt_4', type: 'ping' })
    const r = verifyConnectEvent(raw, sig, { liveSecret: live, testSecret: undefined })
    expect(r?.mode).toBe('live')
  })
})
