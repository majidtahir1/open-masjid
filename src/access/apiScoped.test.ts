import { describe, expect, it } from 'vitest'
import type { Access, PayloadRequest } from 'payload'

import { gateByApiKeyScope, isApiKeyAuth } from './apiScoped'

const reqWith = (user: Record<string, unknown> | null): PayloadRequest =>
  ({ user } as unknown as PayloadRequest)

const argsFor = (req: PayloadRequest): Parameters<Access>[0] =>
  ({ req } as unknown as Parameters<Access>[0])

describe('isApiKeyAuth', () => {
  it('returns false when there is no user', () => {
    expect(isApiKeyAuth(reqWith(null))).toBe(false)
  })

  it('returns false for local-jwt strategy', () => {
    expect(isApiKeyAuth(reqWith({ id: 1, _strategy: 'local-jwt' }))).toBe(false)
  })

  it('returns true for api-key-authenticated users', () => {
    expect(isApiKeyAuth(reqWith({ id: 1, _strategy: 'api-key' }))).toBe(true)
  })

  it('returns false when _strategy is missing', () => {
    expect(isApiKeyAuth(reqWith({ id: 1 }))).toBe(false)
  })
})

const allow: Access = () => true
const deny: Access = () => false
const allowOwnTenant: Access = ({ req }) => {
  const user = req.user as { tenant?: string } | null
  if (!user) return false
  return { tenant: { equals: user.tenant } } as unknown as ReturnType<Access>
}

describe('gateByApiKeyScope', () => {
  describe('UI sessions are never restricted by scopes', () => {
    it('passes through to existing access for a UI session, mapped collection', () => {
      const access = gateByApiKeyScope('prayer-schedules', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'local-jwt', apiScopes: [] })
      expect(access(argsFor(req))).toBe(true)
    })

    it('passes through to existing access for a UI session, unmapped collection', () => {
      const access = gateByApiKeyScope('events', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('still defers to existing access when it denies (UI), unmapped collection', () => {
      const access = gateByApiKeyScope('events', 'update')(deny)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(false)
    })
  })

  describe('API keys with empty/missing scopes are back-compat (inherit role)', () => {
    it('defers to existing access for API key with no apiScopes field, unmapped collection', () => {
      const access = gateByApiKeyScope('events', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'api-key' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('defers to existing access for API key with empty apiScopes, unmapped collection', () => {
      const access = gateByApiKeyScope('events', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: [] })
      expect(access(argsFor(req))).toBe(true)
    })
  })

  describe('API keys with non-empty scopes are default-deny', () => {
    it('denies unmapped collection even when the existing access would allow', () => {
      const access = gateByApiKeyScope('events', 'update')(allow)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:read', 'prayer-times:write'],
      })
      expect(access(argsFor(req))).toBe(false)
    })

    it('denies unmapped collection for every CRUD op', () => {
      const ops = ['read', 'create', 'update', 'delete'] as const
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: ['prayer-times:read'] })
      for (const op of ops) {
        const access = gateByApiKeyScope('carousel-slides', op)(allow)
        expect(access(argsFor(req))).toBe(false)
      }
    })

    it('denies mapped collection + op when the required scope is missing', () => {
      const access = gateByApiKeyScope('prayer-schedules', 'update')(allow)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:read'],
      })
      expect(access(argsFor(req))).toBe(false)
    })

    it('allows mapped collection + op when the required scope is present', () => {
      const access = gateByApiKeyScope('prayer-schedules', 'update')(allow)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:write'],
      })
      expect(access(argsFor(req))).toBe(true)
    })

    it('still defers to existing access (tenant/billing/role wins) when scope matches', () => {
      const access = gateByApiKeyScope('prayer-schedules', 'update')(deny)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:write'],
      })
      expect(access(argsFor(req))).toBe(false)
    })

    it('preserves where-clause returns from existing access', () => {
      const access = gateByApiKeyScope('prayer-schedules', 'read')(allowOwnTenant)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:read'],
        tenant: 'abc',
      })
      expect(access(argsFor(req))).toEqual({ tenant: { equals: 'abc' } })
    })
  })

  describe('missing existing access function falls back to Payload default', () => {
    it('allows authed UI user when no existing access is provided', () => {
      const access = gateByApiKeyScope('events', 'read')(undefined)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('denies anonymous request when no existing access is provided', () => {
      const access = gateByApiKeyScope('events', 'read')(undefined)
      const req = reqWith(null)
      expect(access(argsFor(req))).toBe(false)
    })

    it('denies scoped key on unmapped collection regardless of missing existing access', () => {
      const access = gateByApiKeyScope('events', 'update')(undefined)
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: ['prayer-times:read'] })
      expect(access(argsFor(req))).toBe(false)
    })
  })
})
