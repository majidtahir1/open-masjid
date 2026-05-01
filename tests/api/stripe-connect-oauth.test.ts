import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ---------------------------------------------------------------

const oauthToken = vi.fn()
const oauthDeauthorize = vi.fn()
const accountsRetrieve = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    oauth: { token: oauthToken, deauthorize: oauthDeauthorize },
    accounts: { retrieve: accountsRetrieve },
  }),
}))

// payload.auth / payload.update / payload.findByID
const payloadAuth = vi.fn()
const payloadUpdate = vi.fn()
const payloadFindByID = vi.fn()
const payloadLoggerWarn = vi.fn()

vi.mock('payload', () => ({
  getPayload: async () => ({
    auth: payloadAuth,
    update: payloadUpdate,
    findByID: payloadFindByID,
    logger: { warn: payloadLoggerWarn },
  }),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// next/headers — return a Headers-like object the routes can read
let currentHeaders: Headers
vi.mock('next/headers', () => ({
  headers: async () => currentHeaders,
}))

// ---- Imports under test (after mocks) ------------------------------------
import { GET as authorizeGET } from '@/app/api/stripe/connect/authorize/route'
import { GET as callbackGET } from '@/app/api/stripe/connect/callback/route'
import { POST as disconnectPOST } from '@/app/api/stripe/connect/disconnect/route'
import { signState } from '@/lib/stripe-connect'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PAYLOAD_SECRET = 'test-secret-32-bytes-or-longer-please'
  process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_test_client'
  currentHeaders = new Headers({ host: 'example.com', 'x-forwarded-proto': 'https' })
})

// ---- Tests ---------------------------------------------------------------

describe('GET /api/stripe/connect/authorize', () => {
  it('returns 401 when no user', async () => {
    payloadAuth.mockResolvedValueOnce({ user: null })
    const res = await authorizeGET()
    expect(res.status).toBe(401)
  })

  it('returns 401 for non-admin role', async () => {
    payloadAuth.mockResolvedValueOnce({
      user: { id: 1, role: 'staff', tenant: 7 },
    })
    const res = await authorizeGET()
    expect(res.status).toBe(401)
  })

  it('returns 400 when admin has no tenant', async () => {
    payloadAuth.mockResolvedValueOnce({
      user: { id: 1, role: 'admin', tenant: null },
    })
    const res = await authorizeGET()
    expect(res.status).toBe(400)
  })

  it('redirects to connect.stripe.com with state for an admin', async () => {
    payloadAuth.mockResolvedValueOnce({
      user: { id: 1, role: 'admin', tenant: 7 },
    })
    const res = await authorizeGET()
    expect(res.status).toBe(307) // NextResponse.redirect default
    const loc = res.headers.get('location')!
    expect(loc).toMatch(/^https:\/\/connect\.stripe\.com\/oauth\/authorize\?/)
    const url = new URL(loc)
    expect(url.searchParams.get('client_id')).toBe('ca_test_client')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('read_write')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://example.com/api/stripe/connect/callback',
    )
    expect(url.searchParams.get('state')).toBeTruthy()
  })

  it('accepts platformOwner role', async () => {
    payloadAuth.mockResolvedValueOnce({
      user: { id: 1, role: 'platformOwner', tenant: 7 },
    })
    const res = await authorizeGET()
    expect(res.status).toBe(307)
  })

  it('extracts tenant id from expanded tenant object', async () => {
    payloadAuth.mockResolvedValueOnce({
      user: { id: 1, role: 'admin', tenant: { id: 9, slug: 'x' } },
    })
    const res = await authorizeGET()
    expect(res.status).toBe(307)
  })
})

describe('GET /api/stripe/connect/callback', () => {
  function makeReq(params: Record<string, string>) {
    const u = new URL('https://example.com/api/stripe/connect/callback')
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
    return new Request(u.toString())
  }

  it('redirects to ?status=missing when code or state absent', async () => {
    const res = await callbackGET(makeReq({}))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain(
      '/admin/donations/connect?status=missing',
    )
  })

  it('redirects to ?status=invalid_state for forged state', async () => {
    const res = await callbackGET(makeReq({ code: 'abc', state: 'bad.token' }))
    expect(res.headers.get('location')).toContain('status=invalid_state')
  })

  it('redirects to ?status=user_mismatch when session user differs from state', async () => {
    const state = signState({ tenantId: 7, userId: 1 })
    payloadAuth.mockResolvedValueOnce({ user: { id: 2, role: 'admin', tenant: 7 } })
    const res = await callbackGET(makeReq({ code: 'abc', state }))
    expect(res.headers.get('location')).toContain('status=user_mismatch')
  })

  it('redirects to ?status=tenant_mismatch when session tenant differs', async () => {
    const state = signState({ tenantId: 7, userId: 1 })
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin', tenant: 8 } })
    const res = await callbackGET(makeReq({ code: 'abc', state }))
    expect(res.headers.get('location')).toContain('status=tenant_mismatch')
  })

  it('exchanges code, retrieves account, updates tenant, redirects to success', async () => {
    const state = signState({ tenantId: 7, userId: 1 })
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin', tenant: 7 } })
    oauthToken.mockResolvedValueOnce({ stripe_user_id: 'acct_test_123' })
    accountsRetrieve.mockResolvedValueOnce({
      id: 'acct_test_123',
      charges_enabled: true,
      payouts_enabled: false,
    })
    payloadUpdate.mockResolvedValueOnce({})

    const res = await callbackGET(makeReq({ code: 'abc', state }))
    expect(res.headers.get('location')).toContain('status=success')

    expect(oauthToken).toHaveBeenCalledWith({ grant_type: 'authorization_code', code: 'abc' })
    expect(accountsRetrieve).toHaveBeenCalledWith('acct_test_123')
    expect(payloadUpdate).toHaveBeenCalledTimes(1)
    const args = payloadUpdate.mock.calls[0][0]
    expect(args.collection).toBe('tenants')
    expect(args.id).toBe(7)
    expect(args.overrideAccess).toBe(true)
    expect(args.data.donationConfig).toMatchObject({
      mode: 'connect',
      stripeAccountId: 'acct_test_123',
      stripeChargesEnabled: true,
      stripePayoutsEnabled: false,
    })
    expect(typeof args.data.donationConfig.stripeAccountConnectedAt).toBe('string')
    expect(typeof args.data.donationConfig.stripeAccountLastSyncedAt).toBe('string')
  })
})

describe('POST /api/stripe/connect/disconnect', () => {
  it('returns 401 when no user', async () => {
    payloadAuth.mockResolvedValueOnce({ user: null })
    const res = await disconnectPOST()
    expect(res.status).toBe(401)
  })

  it('returns 401 for non-admin', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'staff', tenant: 7 } })
    const res = await disconnectPOST()
    expect(res.status).toBe(401)
  })

  it('deauthorizes the connected account and clears tenant fields', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin', tenant: 7 } })
    payloadFindByID.mockResolvedValueOnce({
      id: 7,
      donationConfig: { stripeAccountId: 'acct_test_123' },
    })
    oauthDeauthorize.mockResolvedValueOnce({})
    payloadUpdate.mockResolvedValueOnce({})

    const res = await disconnectPOST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ disconnected: true })

    expect(oauthDeauthorize).toHaveBeenCalledWith({
      client_id: 'ca_test_client',
      stripe_user_id: 'acct_test_123',
    })
    const args = payloadUpdate.mock.calls[0][0]
    expect(args.data.donationConfig).toEqual({
      mode: 'external',
      stripeAccountId: null,
      stripeAccountConnectedAt: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeAccountLastSyncedAt: null,
    })
  })

  it('still clears tenant fields when stripe deauthorize throws', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin', tenant: 7 } })
    payloadFindByID.mockResolvedValueOnce({
      id: 7,
      donationConfig: { stripeAccountId: 'acct_test_123' },
    })
    oauthDeauthorize.mockRejectedValueOnce(new Error('stripe down'))
    payloadUpdate.mockResolvedValueOnce({})

    const res = await disconnectPOST()
    expect(res.status).toBe(200)
    expect(payloadLoggerWarn).toHaveBeenCalled()
    expect(payloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('skips deauthorize when no stripe account is connected', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 1, role: 'admin', tenant: 7 } })
    payloadFindByID.mockResolvedValueOnce({ id: 7, donationConfig: {} })
    payloadUpdate.mockResolvedValueOnce({})

    const res = await disconnectPOST()
    expect(res.status).toBe(200)
    expect(oauthDeauthorize).not.toHaveBeenCalled()
    expect(payloadUpdate).toHaveBeenCalledTimes(1)
  })
})
