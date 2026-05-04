/**
 * Pure aggregation helpers for the tenant membership dashboard.
 *
 * These functions are intentionally framework-free so they can be unit tested
 * without a database or HTTP layer. The Overview page maps Payload member
 * documents into `MemberRow[]` and calls `buildAggregates`.
 */

export interface MemberRow {
  id: string | number
  tier: string | number | { id: string | number }
  status: 'active' | 'grace' | 'inactive'
}

export interface TierRow {
  id: string | number
  name: string
  amountCents: number
  cadence: 'monthly' | 'yearly'
}

export interface TierAggregate {
  tierId: string | number
  tierName: string
  activeCount: number
  graceCount: number
  mrrCents: number
}

export interface Aggregates {
  activeCount: number
  graceCount: number
  inactiveCount: number
  mrrCents: number
  byTier: TierAggregate[]
}

function tierIdOf(t: MemberRow['tier']): string | number {
  return typeof t === 'object' && t !== null ? t.id : t
}

/**
 * Monthly recurring revenue contribution for a single tier slot.
 * Yearly tiers contribute amountCents / 12 (rounded to nearest cent).
 * Grace members do NOT contribute to MRR — only active members do.
 */
function monthlyCents(tier: TierRow): number {
  return tier.cadence === 'yearly' ? Math.round(tier.amountCents / 12) : tier.amountCents
}

export function buildAggregates(members: MemberRow[], tiers: TierRow[]): Aggregates {
  const tierById = new Map(tiers.map((t) => [t.id, t]))

  let activeCount = 0
  let graceCount = 0
  let inactiveCount = 0
  let mrrCents = 0

  // Pre-populate byTier so every tier appears even with zero members
  const byTier = new Map<string | number, TierAggregate>(
    tiers.map((t) => [t.id, { tierId: t.id, tierName: t.name, activeCount: 0, graceCount: 0, mrrCents: 0 }]),
  )

  for (const m of members) {
    const tid = tierIdOf(m.tier)
    const tier = tierById.get(tid)
    const bucket = byTier.get(tid)

    if (m.status === 'active') {
      activeCount++
      if (tier && bucket) {
        const c = monthlyCents(tier)
        mrrCents += c
        bucket.activeCount++
        bucket.mrrCents += c
      }
    } else if (m.status === 'grace') {
      graceCount++
      if (bucket) bucket.graceCount++
    } else {
      inactiveCount++
    }
  }

  return {
    activeCount,
    graceCount,
    inactiveCount,
    mrrCents,
    byTier: Array.from(byTier.values()),
  }
}
