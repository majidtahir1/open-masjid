import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ---------------------------------------------------------------

const sessionsCreate = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: sessionsCreate } },
  }),
}))

const payloadFindByID = vi.fn()
vi.mock('payload', () => ({
  getPayload: async () => ({
    findByID: payloadFindByID,
  }),
}))

vi.mock('@payload-config', () => ({ default: {} }))

let currentTenant:
  | {
      id: number | string
      name?: string
      donationConfig?: Record<string, unknown>
    }
  | null = null

vi.mock('@/lib/tenant-server', () => ({
  getCurrentTenant: async () => currentTenant,
}))

let currentHeaders: Headers
vi.mock('next/headers', () => ({
  headers: async () => currentHeaders,
}))

// ---- Imports under test (after mocks) ------------------------------------

import { POST } from '@/app/api/donations/checkout/route'

beforeEach(() => {
  vi.clearAllMocks()
  currentHeaders = new Headers({ host: 'example.com', 'x-forwarded-proto': 'https' })
  currentTenant = {
    id: 7,
    name: 'Masjid Al-Test',
    donationConfig: {
      mode: 'connect',
      stripeAccountId: 'acct_x',
      stripeChargesEnabled: true,
    },
  }
  sessionsCreate.mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/x' })
  payloadFindByID.mockResolvedValue({ id: 1, tenant: 7, active: true, name: 'General' })
})

function makeReq(body: unknown) {
  return new Request('https://example.com/api/donations/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/donations/checkout', () => {
  it('creates a one-time checkout session on the connected account', async () => {
    const res = await POST(makeReq({ fundId: 1, amountCents: 5000, frequency: 'one_time' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://checkout.stripe.com/x')

    expect(sessionsCreate).toHaveBeenCalledTimes(1)
    const [params, options] = sessionsCreate.mock.calls[0]
    expect(options).toEqual({ stripeAccount: 'acct_x' })
    expect(params.mode).toBe('payment')
    expect(params.line_items[0].price_data.unit_amount).toBe(5000)
    expect(params.metadata).toEqual({ tenantId: '7', fundId: '1', frequency: 'one_time' })
    expect(params.payment_intent_data?.metadata).toEqual({
      tenantId: '7',
      fundId: '1',
      frequency: 'one_time',
    })
    expect(params.subscription_data).toBeUndefined()
  })

  it('creates a monthly subscription session and duplicates metadata onto subscription_data', async () => {
    const res = await POST(makeReq({ fundId: 1, amountCents: 2500, frequency: 'monthly' }))
    expect(res.status).toBe(200)
    const [params] = sessionsCreate.mock.calls[0]
    expect(params.mode).toBe('subscription')
    expect(params.line_items[0].price_data.recurring).toEqual({ interval: 'month' })
    expect(params.subscription_data?.metadata).toEqual({
      tenantId: '7',
      fundId: '1',
      frequency: 'monthly',
    })
    expect(params.payment_intent_data).toBeUndefined()
  })

  it('returns 400 when amountCents < 100', async () => {
    const res = await POST(makeReq({ fundId: 1, amountCents: 50, frequency: 'one_time' }))
    expect(res.status).toBe(400)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid frequency', async () => {
    const res = await POST(makeReq({ fundId: 1, amountCents: 5000, frequency: 'yearly' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when fund belongs to a different tenant', async () => {
    payloadFindByID.mockResolvedValueOnce({ id: 1, tenant: 99, active: true })
    const res = await POST(makeReq({ fundId: 1, amountCents: 5000, frequency: 'one_time' }))
    expect(res.status).toBe(404)
  })

  it('returns 404 when fund.active is false', async () => {
    payloadFindByID.mockResolvedValueOnce({ id: 1, tenant: 7, active: false })
    const res = await POST(makeReq({ fundId: 1, amountCents: 5000, frequency: 'one_time' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when stripeChargesEnabled is false', async () => {
    currentTenant!.donationConfig = {
      mode: 'connect',
      stripeAccountId: 'acct_x',
      stripeChargesEnabled: false,
    }
    const res = await POST(makeReq({ fundId: 1, amountCents: 5000, frequency: 'one_time' }))
    expect(res.status).toBe(409)
  })

  it('returns 409 when mode is not connect', async () => {
    currentTenant!.donationConfig = {
      mode: 'external',
      stripeAccountId: 'acct_x',
      stripeChargesEnabled: true,
    }
    const res = await POST(makeReq({ fundId: 1, amountCents: 5000, frequency: 'one_time' }))
    expect(res.status).toBe(409)
  })

  it('returns 404 when no tenant is resolved', async () => {
    currentTenant = null
    const res = await POST(makeReq({ fundId: 1, amountCents: 5000, frequency: 'one_time' }))
    expect(res.status).toBe(404)
  })
})
