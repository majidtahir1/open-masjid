/**
 * Pure aggregation helpers for the tenant donations dashboard.
 *
 * These functions are intentionally framework-free so they can be unit tested
 * without a database or HTTP layer. The Overview page maps Payload donation
 * documents into `DonationRow[]` and calls `computeAggregates`.
 */

export interface DonationRow {
  id: string | number
  amount: number
  currency: string
  frequency: 'one_time' | 'monthly'
  status: 'succeeded' | 'refunded' | 'failed'
  stripePaymentIntentId: string
  stripeChargeId?: string | null
  stripeSubscriptionId?: string | null
  stripeAccountId: string
  createdAt: string
  fund: { id: string | number; name: string }
}

export interface FundAggregate {
  fundId: string | number
  fundName: string
  thisMonthCount: number
  thisMonthCents: number
  ytdCents: number
}

export interface Aggregates {
  thisMonthCents: number
  ytdCents: number
  count: number
  avgCents: number
  monthlyDonorCount: number
  byFund: FundAggregate[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function isSameMonth(d: Date, ref: Date): boolean {
  return d.getUTCFullYear() === ref.getUTCFullYear() && d.getUTCMonth() === ref.getUTCMonth()
}

function isSameYear(d: Date, ref: Date): boolean {
  return d.getUTCFullYear() === ref.getUTCFullYear()
}

export function computeAggregates(rows: DonationRow[], now: Date): Aggregates {
  let thisMonthCents = 0
  let ytdCents = 0
  let count = 0

  const monthlyDonorIds = new Set<string>()
  const cutoff30d = now.getTime() - 30 * MS_PER_DAY

  const fundMap = new Map<string, FundAggregate>()

  for (const r of rows) {
    if (r.status !== 'succeeded') continue
    const created = new Date(r.createdAt)
    const inYear = isSameYear(created, now)
    const inMonth = isSameMonth(created, now)

    if (inYear) {
      ytdCents += r.amount
      count += 1
    }
    if (inMonth) {
      thisMonthCents += r.amount
    }

    if (r.stripeSubscriptionId && created.getTime() >= cutoff30d) {
      monthlyDonorIds.add(r.stripeSubscriptionId)
    }

    const fundKey = String(r.fund.id)
    let agg = fundMap.get(fundKey)
    if (!agg) {
      agg = {
        fundId: r.fund.id,
        fundName: r.fund.name,
        thisMonthCount: 0,
        thisMonthCents: 0,
        ytdCents: 0,
      }
      fundMap.set(fundKey, agg)
    }
    if (inYear) agg.ytdCents += r.amount
    if (inMonth) {
      agg.thisMonthCount += 1
      agg.thisMonthCents += r.amount
    }
  }

  const avgCents = count > 0 ? Math.round(ytdCents / count) : 0

  const byFund = Array.from(fundMap.values()).sort((a, b) =>
    a.fundName.localeCompare(b.fundName),
  )

  return {
    thisMonthCents,
    ytdCents,
    count,
    avgCents,
    monthlyDonorCount: monthlyDonorIds.size,
    byFund,
  }
}
