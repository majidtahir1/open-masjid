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

export interface PricingContext { pricingModel: 'per-program' | 'per-class'; programTuitionCents: number; classPrices: Record<string, number> }

export function participantPricesCents(participants: Record<string, unknown>[], ctx: PricingContext): number[] {
  return participants.map((p) =>
    ctx.pricingModel === 'per-class' ? (ctx.classPrices[String(p.class)] ?? 0) : ctx.programTuitionCents)
}

/**
 * Human label per participant — the student's name, falling back to "Child N"
 * (1-based) when no name was given. Mirrors the public form's tuition summary so
 * the Stripe checkout line items read the same way the registrant just saw.
 */
export function participantLabels(participants: Record<string, unknown>[]): string[] {
  return participants.map((p, i) => {
    const first = String(p.student_first_name ?? '').trim()
    const last = String(p.student_last_name ?? '').trim()
    return `${first} ${last}`.trim() || `Child ${i + 1}`
  })
}
