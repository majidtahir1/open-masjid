import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCustomerForTenant } from '@/lib/billing-stripe-customer'

describe('createCustomerForTenant', () => {
  beforeEach(() => vi.resetAllMocks())

  it('passes tenant metadata to Stripe and returns the customer id', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'cus_123' })
    const stripe = { customers: { create } } as any
    const id = await createCustomerForTenant(stripe, {
      tenantId: 42,
      slug: 'al-noor',
      name: 'Al Noor Masjid',
      email: 'admin@example.com',
    })
    expect(id).toBe('cus_123')
    expect(create).toHaveBeenCalledWith({
      email: 'admin@example.com',
      name: 'Al Noor Masjid',
      metadata: { tenantId: '42', slug: 'al-noor' },
    })
  })
})
