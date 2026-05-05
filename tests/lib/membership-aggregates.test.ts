import { describe, it, expect } from 'vitest'
import { buildAggregates } from '@/lib/membership-aggregates'

const tiers = [
  { id: 1, name: 'Supporting', amountCents: 2500, cadence: 'monthly' as const },
  { id: 2, name: 'Patron', amountCents: 30000, cadence: 'yearly' as const },
]
const members = [
  { id: 'a', tier: 1, status: 'active' },
  { id: 'b', tier: 1, status: 'active' },
  { id: 'c', tier: 2, status: 'active' },
  { id: 'd', tier: 1, status: 'grace' },
  { id: 'e', tier: 1, status: 'inactive' },
]

describe('buildAggregates', () => {
  it('counts active/grace/inactive', () => {
    const a = buildAggregates(members as any, tiers as any)
    expect(a.activeCount).toBe(3)
    expect(a.graceCount).toBe(1)
    expect(a.inactiveCount).toBe(1)
  })

  it('computes MRR (yearly normalized to monthly)', () => {
    const a = buildAggregates(members as any, tiers as any)
    // 2 active × $25 (monthly) + 1 active × $300/12 = $50 + $25 = $75 = 7500 cents
    expect(a.mrrCents).toBe(7500)
  })

  it('per-tier breakdown counts and MRR', () => {
    const a = buildAggregates(members as any, tiers as any)
    const supporting = a.byTier.find((t) => t.tierId === 1)!
    expect(supporting.activeCount).toBe(2)
    expect(supporting.graceCount).toBe(1)
    expect(supporting.mrrCents).toBe(5000)
    const patron = a.byTier.find((t) => t.tierId === 2)!
    expect(patron.activeCount).toBe(1)
    expect(patron.mrrCents).toBe(2500)
  })

  it('returns zero aggregates for empty members list', () => {
    const a = buildAggregates([], tiers as any)
    expect(a.activeCount).toBe(0)
    expect(a.graceCount).toBe(0)
    expect(a.inactiveCount).toBe(0)
    expect(a.mrrCents).toBe(0)
    expect(a.byTier.length).toBe(2)
    expect(a.byTier[0].activeCount).toBe(0)
    expect(a.byTier[0].mrrCents).toBe(0)
  })

  it('handles tier as populated object (depth > 0)', () => {
    const membersWithObj = [
      { id: 'x', tier: { id: 1 }, status: 'active' },
    ]
    const a = buildAggregates(membersWithObj as any, tiers as any)
    expect(a.activeCount).toBe(1)
    expect(a.mrrCents).toBe(2500)
  })
})
