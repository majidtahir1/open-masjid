import { describe, it, expect } from 'vitest'
import { computeAggregates, type DonationRow } from '@/lib/donations-aggregates'

const NOW = new Date('2026-04-15T12:00:00Z')

function row(partial: Partial<DonationRow>): DonationRow {
  return {
    id: partial.id ?? 'r1',
    amount: partial.amount ?? 1000,
    currency: partial.currency ?? 'usd',
    frequency: partial.frequency ?? 'one_time',
    status: partial.status ?? 'succeeded',
    stripePaymentIntentId: partial.stripePaymentIntentId ?? 'pi_x',
    stripeChargeId: partial.stripeChargeId ?? null,
    stripeSubscriptionId: partial.stripeSubscriptionId ?? null,
    stripeAccountId: partial.stripeAccountId ?? 'acct_1',
    createdAt: partial.createdAt ?? '2026-04-10T00:00:00Z',
    fund: partial.fund ?? { id: 1, name: 'General' },
  }
}

describe('computeAggregates', () => {
  it('returns zeros for empty input', () => {
    const agg = computeAggregates([], NOW)
    expect(agg).toEqual({
      thisMonthCents: 0,
      ytdCents: 0,
      count: 0,
      avgCents: 0,
      monthlyDonorCount: 0,
      byFund: [],
    })
  })

  it('excludes refunded rows from totals/counts', () => {
    const rows = [
      row({ id: 1, amount: 1000, status: 'succeeded', createdAt: '2026-04-05T00:00:00Z' }),
      row({ id: 2, amount: 5000, status: 'refunded', createdAt: '2026-04-06T00:00:00Z' }),
      row({ id: 3, amount: 2000, status: 'failed', createdAt: '2026-04-07T00:00:00Z' }),
    ]
    const agg = computeAggregates(rows, NOW)
    expect(agg.thisMonthCents).toBe(1000)
    expect(agg.ytdCents).toBe(1000)
    expect(agg.count).toBe(1)
    expect(agg.avgCents).toBe(1000)
  })

  it('computes thisMonth/YTD from the now arg calendar boundaries', () => {
    const rows = [
      // This month (April 2026)
      row({ id: 1, amount: 1500, createdAt: '2026-04-01T00:00:00Z' }),
      row({ id: 2, amount: 2500, createdAt: '2026-04-14T23:00:00Z' }),
      // YTD but not this month
      row({ id: 3, amount: 1000, createdAt: '2026-02-15T00:00:00Z' }),
      // Prior year — excluded
      row({ id: 4, amount: 9999, createdAt: '2025-12-31T00:00:00Z' }),
    ]
    const agg = computeAggregates(rows, NOW)
    expect(agg.thisMonthCents).toBe(4000)
    expect(agg.ytdCents).toBe(5000)
    expect(agg.count).toBe(3)
    expect(agg.avgCents).toBe(Math.round(5000 / 3))
  })

  it('counts distinct stripeSubscriptionId monthly donors in the last 30 days', () => {
    const rows = [
      row({ id: 1, stripeSubscriptionId: 'sub_a', createdAt: '2026-04-10T00:00:00Z' }),
      row({ id: 2, stripeSubscriptionId: 'sub_a', createdAt: '2026-04-12T00:00:00Z' }),
      row({ id: 3, stripeSubscriptionId: 'sub_b', createdAt: '2026-04-13T00:00:00Z' }),
      row({ id: 4, stripeSubscriptionId: 'sub_c', createdAt: '2026-01-01T00:00:00Z' }), // > 30 days
      row({ id: 5, stripeSubscriptionId: null }), // no sub
      row({
        id: 6,
        stripeSubscriptionId: 'sub_d',
        status: 'refunded',
        createdAt: '2026-04-13T00:00:00Z',
      }),
    ]
    const agg = computeAggregates(rows, NOW)
    expect(agg.monthlyDonorCount).toBe(2)
  })

  it('groups by fund and sorts alphabetically', () => {
    const rows = [
      row({ id: 1, amount: 1000, fund: { id: 2, name: 'Zakat' }, createdAt: '2026-04-05T00:00:00Z' }),
      row({ id: 2, amount: 500, fund: { id: 2, name: 'Zakat' }, createdAt: '2026-02-05T00:00:00Z' }),
      row({ id: 3, amount: 700, fund: { id: 1, name: 'General' }, createdAt: '2026-04-09T00:00:00Z' }),
    ]
    const agg = computeAggregates(rows, NOW)
    expect(agg.byFund.map((f) => f.fundName)).toEqual(['General', 'Zakat'])
    const general = agg.byFund.find((f) => f.fundName === 'General')!
    expect(general.thisMonthCount).toBe(1)
    expect(general.thisMonthCents).toBe(700)
    expect(general.ytdCents).toBe(700)
    const zakat = agg.byFund.find((f) => f.fundName === 'Zakat')!
    expect(zakat.thisMonthCents).toBe(1000)
    expect(zakat.ytdCents).toBe(1500)
    expect(zakat.thisMonthCount).toBe(1)
  })
})
