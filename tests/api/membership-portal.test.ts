import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessionsCreate = vi.fn()
vi.mock('@/lib/stripe-connect', () => ({
  stripeForAccount: () => ({
    billingPortal: { sessions: { create: sessionsCreate } },
  }),
}))

let currentTenant:
  | {
      id: number | string
      slug?: string
      donationConfig?: { stripeAccountId?: string | null }
    }
  | null = null
vi.mock('@/lib/tenant-server', () => ({
  getCurrentTenant: async () => currentTenant,
}))

import { POST } from '@/app/api/membership/portal/route'
import { signMembershipPortalToken } from '@/lib/membership-portal-token'

function makeReq(portalToken?: string) {
  const form = new FormData()
  if (portalToken) form.set('portalToken', portalToken)
  return new Request('https://example.com/api/membership/portal', {
    method: 'POST',
    body: form,
    headers: { origin: 'https://example.com' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PAYLOAD_SECRET = 'test-secret-32-bytes-or-longer-please'
  currentTenant = {
    id: 7,
    slug: 'al-test',
    donationConfig: { stripeAccountId: 'acct_123' },
  }
  sessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session/test' })
})

describe('POST /api/membership/portal', () => {
  it('returns 404 when no tenant is resolved', async () => {
    currentTenant = null
    const res = await POST(makeReq())
    expect(res.status).toBe(404)
  })

  it('returns 400 when no portal token is provided', async () => {
    const res = await POST(makeReq())
    expect(res.status).toBe(400)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('returns 403 for an invalid portal token', async () => {
    const res = await POST(makeReq('not-a-valid-token'))
    expect(res.status).toBe(403)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('returns 403 when the token tenant does not match the resolved tenant', async () => {
    const token = signMembershipPortalToken({ tenantId: 99, customerId: 'cus_123' })
    const res = await POST(makeReq(token))
    expect(res.status).toBe(403)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('creates a billing portal session from a valid signed token', async () => {
    const token = signMembershipPortalToken({ tenantId: 7, customerId: 'cus_123' })
    const res = await POST(makeReq(token))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://billing.stripe.com/session/test')
    expect(sessionsCreate).toHaveBeenCalledWith(
      {
        customer: 'cus_123',
        return_url: 'https://example.com/membership',
      },
      { stripeAccount: 'acct_123' },
    )
  })
})
