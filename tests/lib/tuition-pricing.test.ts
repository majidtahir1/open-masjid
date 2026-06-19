import { describe, it, expect } from 'vitest'
import { computeSiblingDiscount } from '@/lib/tuition-pricing'

const tiers = [{ rank: 2, percentOff: 50 }, { rank: 3, percentOff: 100 }]

describe('computeSiblingDiscount', () => {
  it('charges the most expensive full, discounts the rest by rank', () => {
    // input order [8000, 10000, 6000] → ranks [2, 1, 3] → [4000, 10000, 0]
    // (result preserves input order; ranking is by price descending)
    expect(computeSiblingDiscount([8000, 10000, 6000], tiers)).toEqual([4000, 10000, 0])
  })
  it('per-program (equal prices) — 2nd child half off', () => {
    expect(computeSiblingDiscount([5000, 5000], [{ rank: 2, percentOff: 50 }])).toEqual([5000, 2500])
  })
  it('no tiers → no discount', () => {
    expect(computeSiblingDiscount([5000, 5000], [])).toEqual([5000, 5000])
  })
  it('single child → full price', () => {
    expect(computeSiblingDiscount([5000], tiers)).toEqual([5000])
  })
})
