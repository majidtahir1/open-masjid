import { describe, it, expect, vi, beforeEach } from 'vitest'

const payloadFind = vi.fn()
const payloadAuth = vi.fn()
vi.mock('payload', () => ({
  getPayload: async () => ({ find: payloadFind, auth: payloadAuth }),
}))
vi.mock('@payload-config', () => ({ default: {} }))

let currentHeaders: Headers
vi.mock('next/headers', () => ({
  headers: async () => currentHeaders,
}))

let currentTenant:
  | { id: number | string; slug?: string; name?: string }
  | null = null
vi.mock('@/lib/tenant-server', () => ({
  getCurrentTenant: async () => currentTenant,
}))

import { GET } from '@/app/api/members/export.csv/route'

beforeEach(() => {
  vi.clearAllMocks()
  currentHeaders = new Headers()
  currentTenant = { id: 7, slug: 'al-test', name: 'Masjid Al-Test' }
  payloadAuth.mockResolvedValue({
    user: { id: 1, role: 'admin', tenant: 7 },
  })
  payloadFind.mockResolvedValue({
    docs: [
      {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-1234',
        tier: { id: 1, name: 'Supporting' },
        status: 'active',
        stripeSubscriptionStatus: 'active',
        joinedAt: '2026-04-01T00:00:00.000Z',
        currentPeriodEnd: '2026-05-01T00:00:00.000Z',
        canceledAt: null,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      },
    ],
  })
})

describe('GET /api/members/export.csv', () => {
  it('returns 404 when no tenant resolved', async () => {
    currentTenant = null
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns 401 when no authenticated user is present', async () => {
    payloadAuth.mockResolvedValueOnce({ user: null })
    const res = await GET()
    expect(res.status).toBe(401)
    expect(payloadFind).not.toHaveBeenCalled()
  })

  it('returns 403 for staff users', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 2, role: 'staff', tenant: 7 } })
    const res = await GET()
    expect(res.status).toBe(403)
    expect(payloadFind).not.toHaveBeenCalled()
  })

  it('returns 403 when an admin belongs to a different tenant', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 3, role: 'admin', tenant: 99 } })
    const res = await GET()
    expect(res.status).toBe(403)
    expect(payloadFind).not.toHaveBeenCalled()
  })

  it('returns CSV with the expected member data for an admin in the same tenant', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/csv; charset=utf-8/)
    const text = await res.text()
    expect(text).toContain('name,email,phone,tier,status')
    expect(text).toContain('Jane Doe,jane@example.com,555-1234,Supporting,active')
  })

  it('allows platform owners regardless of tenant field', async () => {
    payloadAuth.mockResolvedValueOnce({ user: { id: 4, role: 'platformOwner', tenant: null } })
    const res = await GET()
    expect(res.status).toBe(200)
  })
})
