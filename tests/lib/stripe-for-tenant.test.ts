import { describe, it, expect, beforeEach } from 'vitest'
import { getStripe, getStripeTest, getStripeForTenant, __resetStripeCache } from '@/lib/stripe'

describe('getStripeForTenant', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_dummy'
    process.env.STRIPE_SECRET_KEY_TEST = 'sk_test_dummy'
    __resetStripeCache()
  })

  it('returns the live client for a normal tenant', () => {
    expect(getStripeForTenant({ demoMode: false })).toBe(getStripe())
  })

  it('returns the test client for a demo tenant', () => {
    expect(getStripeForTenant({ demoMode: true })).toBe(getStripeTest())
  })

  it('returns the live client when tenant is null/undefined', () => {
    expect(getStripeForTenant(null)).toBe(getStripe())
    expect(getStripeForTenant(undefined)).toBe(getStripe())
  })

  it('caches each client (same instance across calls)', () => {
    expect(getStripeTest()).toBe(getStripeTest())
  })
})
