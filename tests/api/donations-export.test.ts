import { describe, it, expect, vi, beforeEach } from 'vitest'

const payloadFind = vi.fn()
vi.mock('payload', () => ({
  getPayload: async () => ({ find: payloadFind }),
}))
vi.mock('@payload-config', () => ({ default: {} }))

let currentTenant:
  | { id: number | string; slug?: string; name?: string }
  | null = null
vi.mock('@/lib/tenant-server', () => ({
  getCurrentTenant: async () => currentTenant,
}))

import { GET } from '@/app/api/donations/export.csv/route'

beforeEach(() => {
  vi.clearAllMocks()
  currentTenant = { id: 7, slug: 'al-test', name: 'Masjid Al-Test' }
  payloadFind.mockResolvedValue({
    docs: [
      {
        id: 1,
        createdAt: '2026-04-01T12:34:56Z',
        fund: { id: 1, name: 'General' },
        amount: 5000,
        currency: 'usd',
        frequency: 'one_time',
        status: 'succeeded',
        stripePaymentIntentId: 'pi_1',
        stripeSubscriptionId: null,
        stripeAccountId: 'acct_x',
      },
      {
        id: 2,
        createdAt: '2026-04-02T00:00:00Z',
        fund: { id: 2, name: 'Zakat, Special' }, // contains comma
        amount: 2500,
        currency: 'usd',
        frequency: 'monthly',
        status: 'refunded',
        stripePaymentIntentId: 'pi_2',
        stripeSubscriptionId: 'sub_2',
        stripeAccountId: 'acct_x',
      },
    ],
  })
})

describe('GET /api/donations/export.csv', () => {
  it('returns 404 when no tenant resolved', async () => {
    currentTenant = null
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns CSV with correct headers and content-type', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/csv; charset=utf-8/)
    const cd = res.headers.get('content-disposition') ?? ''
    expect(cd).toMatch(/attachment;\s*filename="donations-al-test-\d{4}-\d{2}-\d{2}\.csv"/)
    const text = await res.text()
    const lines = text.trim().split('\n')
    expect(lines[0]).toBe(
      'created_at,fund,amount_cents,currency,frequency,status,stripe_payment_intent_id,stripe_subscription_id',
    )
    // Row 1
    expect(lines[1]).toBe(
      '2026-04-01T12:34:56.000Z,General,5000,usd,one_time,succeeded,pi_1,',
    )
    // Row 2 — fund name has a comma, must be quoted
    expect(lines[2]).toBe(
      '2026-04-02T00:00:00.000Z,"Zakat, Special",2500,usd,monthly,refunded,pi_2,sub_2',
    )
  })

  it('queries only succeeded and refunded rows for current tenant', async () => {
    await GET()
    expect(payloadFind).toHaveBeenCalledTimes(1)
    const args = payloadFind.mock.calls[0][0]
    expect(args.collection).toBe('donations')
    expect(args.where.tenant.equals).toBe(7)
    expect(args.where.status.in).toEqual(['succeeded', 'refunded'])
  })
})
