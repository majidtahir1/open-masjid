import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ---------------------------------------------------------------

const sessionsRetrieve = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { retrieve: sessionsRetrieve } },
  }),
}))

const payloadFindByID = vi.fn()
const payloadUpdate = vi.fn()

vi.mock('payload', () => ({
  getPayload: async () => ({
    findByID: payloadFindByID,
    update: payloadUpdate,
  }),
}))

vi.mock('@payload-config', () => ({ default: {} }))

let currentTenant: { id: number | string; stripeAccountId?: string | null } | null = null

vi.mock('@/lib/tenant-server', () => ({
  getCurrentTenant: async () => currentTenant,
}))

// ---- Imports under test (after mocks) ------------------------------------

import { GET } from '@/app/api/forms/[slug]/checkout-success/route'

// ---- Helpers -------------------------------------------------------------

function makeReq(slug: string, sid?: string) {
  const url = sid
    ? `https://example.com/api/forms/${slug}/checkout-success?sid=${sid}`
    : `https://example.com/api/forms/${slug}/checkout-success`
  return new Request(url)
}

function makeParams(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) }
}

// ---- Setup ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()

  currentTenant = { id: 7, stripeAccountId: 'acct_test' }

  sessionsRetrieve.mockResolvedValue({
    id: 'cs_test',
    payment_status: 'paid',
    payment_intent: 'pi_test',
    amount_total: 5000,
    currency: 'usd',
    metadata: { submissionId: 'sub_abc' },
  })

  payloadFindByID.mockResolvedValue({
    id: 'sub_abc',
    paymentStatus: 'pending_payment',
    tenant: 7,
    amountCents: 5000,
    currency: 'usd',
  })

  payloadUpdate.mockResolvedValue({})
})

// ---- Tests ---------------------------------------------------------------

describe('GET /api/forms/[slug]/checkout-success', () => {
  it('redirects to /forms/<slug>/thanks?s=<id> on success', async () => {
    const res = await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'https://example.com/forms/my-form/thanks?s=sub_abc',
    )
  })

  it('calls payload.update with paid status when submission is pending_payment', async () => {
    await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(payloadUpdate).toHaveBeenCalledTimes(1)
    const args = payloadUpdate.mock.calls[0][0]
    expect(args.collection).toBe('form-submissions')
    expect(args.id).toBe('sub_abc')
    expect(args.data.paymentStatus).toBe('paid')
    expect(args.data.stripePaymentIntentId).toBe('pi_test')
    expect(args.data.amountCents).toBe(5000)
    expect(args.data.currency).toBe('usd')
    expect(typeof args.data.paidAt).toBe('string')
    expect(new Date(args.data.paidAt).getTime()).toBeGreaterThan(0)
  })

  it('retrieves Stripe session on the connected account', async () => {
    await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(sessionsRetrieve).toHaveBeenCalledTimes(1)
    const [sessionId, options] = sessionsRetrieve.mock.calls[0]
    expect(sessionId).toBe('cs_test')
    expect(options).toEqual({ stripeAccount: 'acct_test' })
  })

  it('returns 400 when sid is missing', async () => {
    const res = await GET(makeReq('my-form'), makeParams('my-form'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('missing_sid')
  })

  it('returns 404 when tenant is null', async () => {
    currentTenant = null
    const res = await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('no_account')
  })

  it('returns 404 when tenant has no stripeAccountId', async () => {
    currentTenant = { id: 7, stripeAccountId: null }
    const res = await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('no_account')
  })

  it('returns 400 when session metadata has no submissionId', async () => {
    sessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_test',
      payment_status: 'paid',
      payment_intent: 'pi_test',
      amount_total: 5000,
      currency: 'usd',
      metadata: {},
    })
    const res = await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('missing_metadata')
  })

  it('does NOT call payload.update when submission is already paid (idempotent)', async () => {
    payloadFindByID.mockResolvedValueOnce({
      id: 'sub_abc',
      paymentStatus: 'paid',
      tenant: 7,
      amountCents: 5000,
      currency: 'usd',
    })
    const res = await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(payloadUpdate).not.toHaveBeenCalled()
    // Still redirects
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'https://example.com/forms/my-form/thanks?s=sub_abc',
    )
  })

  it('does NOT call payload.update when Stripe payment_status is not paid', async () => {
    sessionsRetrieve.mockResolvedValueOnce({
      id: 'cs_test',
      payment_status: 'unpaid',
      payment_intent: 'pi_test',
      amount_total: 5000,
      currency: 'usd',
      metadata: { submissionId: 'sub_abc' },
    })
    payloadFindByID.mockResolvedValueOnce({
      id: 'sub_abc',
      paymentStatus: 'pending_payment',
      tenant: 7,
      amountCents: 5000,
      currency: 'usd',
    })
    const res = await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(payloadUpdate).not.toHaveBeenCalled()
    // Still redirects
    expect(res.status).toBe(303)
  })

  it('returns 403 and does not update when the submission belongs to another tenant', async () => {
    payloadFindByID.mockResolvedValueOnce({
      id: 'sub_abc',
      paymentStatus: 'pending_payment',
      tenant: 999, // different from currentTenant.id (7)
      amountCents: 5000,
      currency: 'usd',
    })
    const res = await GET(makeReq('my-form', 'cs_test'), makeParams('my-form'))
    expect(res.status).toBe(403)
    expect(payloadUpdate).not.toHaveBeenCalled()
  })
})
