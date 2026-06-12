// tests/ansari/endpoints-nudges.test.ts
import { describe, expect, it, vi } from 'vitest'

import { ansariNudgesEndpoint, ansariNudgeAckEndpoint } from '@/endpoints/ansari/nudges'

function req(over: Record<string, unknown> = {}) {
  return {
    user: { id: 1, role: 'admin', tenant: 7, _strategy: 'api-key', apiScopes: ['ansari:nudges'] },
    payload: {
      findByID: vi.fn(async () => ({ id: 7, location: { timezone: 'America/Chicago' } })),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(async (a: { data: object }) => ({ id: 1, ...a.data })),
      update: vi.fn(async (a: { data: object }) => a.data),
      count: vi.fn(async () => ({ totalDocs: 0 })),
      delete: vi.fn(async () => ({ docs: [], errors: [] })),
      logger: { error: vi.fn(), warn: vi.fn() },
    },
    routeParams: {},
    ...over,
  } as never
}

describe('GET /api/ansari/nudges', () => {
  it('401s without a user', async () => {
    const res = await ansariNudgesEndpoint.handler(req({ user: null }))
    expect(res.status).toBe(401)
  })

  it('403s an API key missing the ansari:nudges scope', async () => {
    const res = await ansariNudgesEndpoint.handler(
      req({ user: { id: 1, role: 'admin', tenant: 7, _strategy: 'api-key', apiScopes: ['prayer-times:read'] } }),
    )
    expect(res.status).toBe(403)
  })

  it('returns the pipeline output for the caller tenant', async () => {
    const res = await ansariNudgesEndpoint.handler(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('nudges')
    expect(Array.isArray(body.nudges)).toBe(true)
  })
})

describe('POST /api/ansari/nudges/:id/ack', () => {
  it('marks an emitted state delivered', async () => {
    const payload = {
      findByID: vi.fn(async () => ({ id: 55, tenant: 7, status: 'emitted' })),
      update: vi.fn(async (a: { data: object }) => a.data),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(),
      count: vi.fn(async () => ({ totalDocs: 0 })),
      delete: vi.fn(async () => ({ docs: [], errors: [] })),
      logger: { error: vi.fn(), warn: vi.fn() },
    }
    const res = await ansariNudgeAckEndpoint.handler(req({ payload, routeParams: { id: '55' } }))
    expect(res.status).toBe(200)
    // uses state.id (not raw routeParams string) and returns 'delivered'
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'nudge-states',
        id: 55,
        data: expect.objectContaining({ status: 'delivered' }),
      }),
    )
    expect((await res.json()).status).toBe('delivered')
  })

  it('returns the truthful status for an already-delivered state (no double-update)', async () => {
    const payload = {
      findByID: vi.fn(async () => ({ id: 55, tenant: 7, status: 'delivered' })),
      update: vi.fn(async (a: { data: object }) => a.data),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(),
      count: vi.fn(async () => ({ totalDocs: 0 })),
      delete: vi.fn(async () => ({ docs: [], errors: [] })),
      logger: { error: vi.fn(), warn: vi.fn() },
    }
    const res = await ansariNudgeAckEndpoint.handler(req({ payload, routeParams: { id: '55' } }))
    expect(res.status).toBe(200)
    // update must NOT be called — state already delivered
    expect(payload.update).not.toHaveBeenCalled()
    expect((await res.json()).status).toBe('delivered')
  })

  it('is idempotent for unknown ids (404 from Payload → graceful unknown)', async () => {
    const payload = {
      findByID: vi.fn(async () => {
        throw Object.assign(new Error('NotFound'), { status: 404 })
      }),
      update: vi.fn(),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(),
      count: vi.fn(async () => ({ totalDocs: 0 })),
      delete: vi.fn(async () => ({ docs: [], errors: [] })),
      logger: { error: vi.fn(), warn: vi.fn() },
    }
    const res = await ansariNudgeAckEndpoint.handler(req({ payload, routeParams: { id: '999' } }))
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('unknown')
  })

  it('returns 500 when findByID throws a non-404 error (infrastructure error ≠ missing)', async () => {
    const payload = {
      findByID: vi.fn(async () => {
        throw Object.assign(new Error('boom'), { status: 500 })
      }),
      update: vi.fn(),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(),
      count: vi.fn(async () => ({ totalDocs: 0 })),
      delete: vi.fn(async () => ({ docs: [], errors: [] })),
      logger: { error: vi.fn(), warn: vi.fn() },
    }
    const res = await ansariNudgeAckEndpoint.handler(req({ payload, routeParams: { id: '55' } }))
    expect(res.status).toBe(500)
    expect((await res.json()).status).toBe('error')
  })

  it('is graceful (not 404) for a state belonging to another tenant (existence oracle closed)', async () => {
    const payload = {
      findByID: vi.fn(async () => ({ id: 55, tenant: 999, status: 'emitted' })),
      update: vi.fn(),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(),
      count: vi.fn(async () => ({ totalDocs: 0 })),
      delete: vi.fn(async () => ({ docs: [], errors: [] })),
      logger: { error: vi.fn(), warn: vi.fn() },
    }
    const res = await ansariNudgeAckEndpoint.handler(req({ payload, routeParams: { id: '55' } }))
    // Must NOT be 404 — that would reveal the id exists on another tenant
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('unknown')
    expect(payload.update).not.toHaveBeenCalled()
  })
})
