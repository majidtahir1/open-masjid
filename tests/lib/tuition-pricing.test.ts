import { describe, it, expect } from 'vitest'
import { computeSiblingDiscount, participantPricesCents } from '@/lib/tuition-pricing'

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

describe('participantPricesCents', () => {
  it('per-program: all participants pay the program price', () => {
    expect(participantPricesCents(
      [{}, {}], { pricingModel: 'per-program', programTuitionCents: 5000, classPrices: {} },
    )).toEqual([5000, 5000])
  })
  it('per-class: each participant pays their class price', () => {
    expect(participantPricesCents(
      [{ class: '3' }, { class: '8' }], { pricingModel: 'per-class', programTuitionCents: 0, classPrices: { '3': 9000, '8': 6000 } },
    )).toEqual([9000, 6000])
  })
})
