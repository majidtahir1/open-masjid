import { describe, it, expect } from 'vitest'
import { buildTuitionLineItems } from '@/lib/tuition-checkout'

describe('buildTuitionLineItems', () => {
  it('builds one line item per participant at the discounted amount with monthly recurring price_data', () => {
    const items = buildTuitionLineItems([10000, 4000], 'usd', 'Sunday School')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      price_data: {
        currency: 'usd',
        unit_amount: 10000,
        recurring: { interval: 'month' },
        product_data: { name: expect.stringContaining('Sunday School') },
      },
      quantity: 1,
    })
    expect(items[1].price_data?.unit_amount).toBe(4000)
  })
})
