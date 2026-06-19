export interface DiscountTier { rank: number; percentOff: number }

/**
 * Returns discounted cents per input price, preserving input order.
 * Ranking is by price descending (most expensive = rank 1, pays full).
 */
export function computeSiblingDiscount(pricesCents: number[], tiers: DiscountTier[]): number[] {
  const byRank = new Map<number, number>()
  for (const t of tiers) byRank.set(t.rank, t.percentOff)
  // index sorted by price desc, ties keep original order
  const order = pricesCents.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p || a.i - b.i)
  const out = new Array<number>(pricesCents.length)
  order.forEach((entry, idx) => {
    const rank = idx + 1
    const pct = byRank.get(rank) ?? 0
    out[entry.i] = Math.round(entry.p * (1 - Math.min(Math.max(pct, 0), 100) / 100))
  })
  return out
}
