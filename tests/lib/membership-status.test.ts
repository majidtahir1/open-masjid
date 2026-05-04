// tests/lib/membership-status.test.ts
import { describe, it, expect } from 'vitest'
import { bucketFromStripeStatus } from '@/lib/membership-status'

describe('bucketFromStripeStatus', () => {
  it.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['past_due', 'grace'],
    ['unpaid', 'grace'],
    ['canceled', 'inactive'],
    ['incomplete', 'inactive'],
    ['incomplete_expired', 'inactive'],
    ['paused', 'inactive'],
    ['unknown_status', 'inactive'],
  ])('%s → %s', (s, expected) => {
    expect(bucketFromStripeStatus(s)).toBe(expected)
  })
})
