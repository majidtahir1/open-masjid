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
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('still defers to existing access when it denies (UI), unmapped collection', () => {
      const access = gateByApiKeyScope('pages', 'update')(deny)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(false)
    })
  })

  describe('API keys with empty/missing scopes are back-compat (inherit role)', () => {
    it('defers to existing access for API key with no apiScopes field, unmapped collection', () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'api-key' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('defers to existing access for API key with empty apiScopes, unmapped collection', () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: [] })
      expect(access(argsFor(req))).toBe(true)
    })
  })

  describe('API keys with non-empty scopes are default-deny', () => {
    it('denies unmapped collection even when the existing access would allow', () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
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
      const access = gateByApiKeyScope('pages', 'read')(undefined)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('denies anonymous request when no existing access is provided', () => {
      const access = gateByApiKeyScope('pages', 'read')(undefined)
      const req = reqWith(null)
      expect(access(argsFor(req))).toBe(false)
    })

    it('denies scoped key on unmapped collection regardless of missing existing access', () => {
      const access = gateByApiKeyScope('pages', 'update')(undefined)
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: ['prayer-times:read'] })
      expect(access(argsFor(req))).toBe(false)
    })
  })

  describe('v1 capability-surface mappings', () => {
    const keyWith = (scopes: string[]) =>
      reqWith({ id: 1, _strategy: 'api-key', apiScopes: scopes })

    // [slug, op, requiredScope] — the scope that must be present to pass.
    const allowCases: Array<[string, 'read' | 'create' | 'update' | 'delete', string]> = [
      ['announcements', 'read', 'announcements:read'],
      ['announcements', 'create', 'announcements:write'],
      ['announcements', 'update', 'announcements:write'],
      ['announcements', 'delete', 'announcements:write'],
      ['forms', 'read', 'forms:read'],
      ['forms', 'create', 'forms:write'],
      ['forms', 'update', 'forms:write'],
      ['forms', 'delete', 'forms:write'],
      ['form-submissions', 'read', 'forms:read'],
      ['events', 'read', 'events:read'],
      ['events', 'create', 'events:write'],
      ['events', 'update', 'events:write'],
      ['events', 'delete', 'events:write'],
      ['members', 'read', 'members:read'],
      ['media', 'read', 'media:read'],
      ['media', 'create', 'media:write'],
      ['media', 'update', 'media:write'],
      ['media', 'delete', 'media:write'],
    ]

    for (const [slug, op, scope] of allowCases) {
      it(`allows ${op} on ${slug} when key has ${scope}`, () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(access(argsFor(keyWith([scope])))).toBe(true)
      })

      it(`denies ${op} on ${slug} when key lacks ${scope}`, () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        // a non-empty but irrelevant scope set → default-deny
        expect(access(argsFor(keyWith(['prayer-times:read'])))).toBe(false)
      })
    }

    // Read scope must NOT grant writes.
    const readDoesNotGrantWrite: Array<[string, 'create' | 'update' | 'delete', string]> = [
      ['announcements', 'create', 'announcements:read'],
      ['forms', 'update', 'forms:read'],
      ['events', 'delete', 'events:read'],
      ['media', 'create', 'media:read'],
    ]
    for (const [slug, op, readScope] of readDoesNotGrantWrite) {
      it(`denies ${op} on ${slug} when key only has ${readScope}`, () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(access(argsFor(keyWith([readScope])))).toBe(false)
      })
    }

    // Read-only collections expose no write mapping → scoped keys are denied writes.
    const readOnlyWriteDenied: Array<[string, 'create' | 'update' | 'delete']> = [
      ['members', 'create'],
      ['members', 'update'],
      ['members', 'delete'],
      ['form-submissions', 'create'],
      ['form-submissions', 'update'],
      ['form-submissions', 'delete'],
    ]
    for (const [slug, op] of readOnlyWriteDenied) {
      it(`denies ${op} on read-only ${slug} even with that domain's read scope`, () => {
        const readScope = slug === 'form-submissions' ? 'forms:read' : `${slug}:read`
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(access(argsFor(keyWith([readScope])))).toBe(false)
      })
    }

    it('preserves a where-clause return from existing access on a newly mapped collection', () => {
      const access = gateByApiKeyScope('members', 'read')(allowOwnTenant)
      const req = keyWith(['members:read'])
      ;(req.user as { tenant?: string }).tenant = 'abc'
      expect(access(argsFor(req))).toEqual({ tenant: { equals: 'abc' } })
    })
  })
})

describe('scoped keys can always read their own user record (/api/users/me)', () => {
  const scopedKey = { id: 42, _strategy: 'api-key', apiScopes: ['forms:read'] }

  it('returns a self-only where clause for users read, regardless of scopes', () => {
    const access = gateByApiKeyScope('users', 'read')(allow)
    expect(access(argsFor(reqWith(scopedKey)))).toEqual({ id: { equals: 42 } })
  })

  it('does not consult existing access for self-read (narrower than any role read)', () => {
    const access = gateByApiKeyScope('users', 'read')(deny)
    expect(access(argsFor(reqWith(scopedKey)))).toEqual({ id: { equals: 42 } })
  })

  it('still denies users create/update/delete for scoped keys', () => {
    for (const op of ['create', 'update', 'delete'] as const) {
      const access = gateByApiKeyScope('users', op)(allow)
      expect(access(argsFor(reqWith(scopedKey)))).toBe(false)
    }
  })

  it('leaves UI sessions and unscoped keys on the existing users read access', () => {
    const access = gateByApiKeyScope('users', 'read')(allow)
    expect(access(argsFor(reqWith({ id: 1, _strategy: 'local-jwt' })))).toBe(true)
    expect(access(argsFor(reqWith({ id: 1, _strategy: 'api-key', apiScopes: [] })))).toBe(true)
  })
})

describe('scoped keys can read tenants via existing access (slug lookup for public URLs)', () => {
  const scopedKey = { id: 42, _strategy: 'api-key', apiScopes: ['forms:read'], tenant: 4 }

  it('defers tenants read to existing access instead of default-deny', () => {
    const access = gateByApiKeyScope('tenants', 'read')(allowOwnTenant)
    expect(access(argsFor(reqWith(scopedKey)))).toEqual({ tenant: { equals: 4 } })
  })

  it('still denies tenants create/update/delete for scoped keys', () => {
    for (const op of ['create', 'update', 'delete'] as const) {
      const access = gateByApiKeyScope('tenants', op)(allow)
      expect(access(argsFor(reqWith(scopedKey)))).toBe(false)
    }
  })
})
