import { describe, expect, it } from 'vitest'
import type { Access, PayloadRequest } from 'payload'

import { denyScopedApiKeyRead, gateByApiKeyScope, isApiKeyAuth, isScopedApiKey } from './apiScoped'
import { Users } from '../collections/Users'
import { Tenants } from '../collections/Tenants'

const reqWith = (user: Record<string, unknown> | null): PayloadRequest =>
  ({ user } as unknown as PayloadRequest)

const argsFor = (req: PayloadRequest): Parameters<Access>[0] =>
  ({ req } as unknown as Parameters<Access>[0])

describe('isApiKeyAuth', () => {
  it('returns false when there is no user', async () => {
    expect(isApiKeyAuth(reqWith(null))).toBe(false)
  })

  it('returns false for local-jwt strategy', async () => {
    expect(isApiKeyAuth(reqWith({ id: 1, _strategy: 'local-jwt' }))).toBe(false)
  })

  it('returns true for api-key-authenticated users', async () => {
    expect(isApiKeyAuth(reqWith({ id: 1, _strategy: 'api-key' }))).toBe(true)
  })

  it('returns false when _strategy is missing', async () => {
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
    it('passes through to existing access for a UI session, mapped collection', async () => {
      const access = gateByApiKeyScope('prayer-schedules', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'local-jwt', apiScopes: [] })
      expect(await access(argsFor(req))).toBe(true)
    })

    it('passes through to existing access for a UI session, unmapped collection', async () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(await access(argsFor(req))).toBe(true)
    })

    it('still defers to existing access when it denies (UI), unmapped collection', async () => {
      const access = gateByApiKeyScope('pages', 'update')(deny)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(await access(argsFor(req))).toBe(false)
    })
  })

  describe('API keys with empty/missing scopes are back-compat (inherit role)', () => {
    it('defers to existing access for API key with no apiScopes field, unmapped collection', async () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'api-key' })
      expect(await access(argsFor(req))).toBe(true)
    })

    it('defers to existing access for API key with empty apiScopes, unmapped collection', async () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: [] })
      expect(await access(argsFor(req))).toBe(true)
    })
  })

  describe('API keys with non-empty scopes are default-deny', () => {
    it('denies unmapped collection even when the existing access would allow', async () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:read', 'prayer-times:write'],
      })
      expect(await access(argsFor(req))).toBe(false)
    })

    it('denies unmapped collection for every CRUD op', async () => {
      const ops = ['read', 'create', 'update', 'delete'] as const
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: ['prayer-times:read'] })
      for (const op of ops) {
        const access = gateByApiKeyScope('carousel-slides', op)(allow)
        expect(await access(argsFor(req))).toBe(false)
      }
    })

    it('denies mapped collection + op when the required scope is missing', async () => {
      const access = gateByApiKeyScope('prayer-schedules', 'update')(allow)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:read'],
      })
      expect(await access(argsFor(req))).toBe(false)
    })

    it('allows mapped collection + op when the required scope is present', async () => {
      const access = gateByApiKeyScope('prayer-schedules', 'update')(allow)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:write'],
      })
      expect(await access(argsFor(req))).toBe(true)
    })

    it('still defers to existing access (tenant/billing/role wins) when scope matches', async () => {
      const access = gateByApiKeyScope('prayer-schedules', 'update')(deny)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:write'],
      })
      expect(await access(argsFor(req))).toBe(false)
    })

    it('preserves where-clause returns from existing access', async () => {
      const access = gateByApiKeyScope('prayer-schedules', 'read')(allowOwnTenant)
      const req = reqWith({
        id: 1,
        _strategy: 'api-key',
        apiScopes: ['prayer-times:read'],
        tenant: 'abc',
      })
      expect(await access(argsFor(req))).toEqual({ tenant: { equals: 'abc' } })
    })
  })

  describe('missing existing access function falls back to Payload default', () => {
    it('allows authed UI user when no existing access is provided', async () => {
      const access = gateByApiKeyScope('pages', 'read')(undefined)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(await access(argsFor(req))).toBe(true)
    })

    it('denies anonymous request when no existing access is provided', async () => {
      const access = gateByApiKeyScope('pages', 'read')(undefined)
      const req = reqWith(null)
      expect(await access(argsFor(req))).toBe(false)
    })

    it('denies scoped key on unmapped collection regardless of missing existing access', async () => {
      const access = gateByApiKeyScope('pages', 'update')(undefined)
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: ['prayer-times:read'] })
      expect(await access(argsFor(req))).toBe(false)
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
      it(`allows ${op} on ${slug} when key has ${scope}`, async () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(await access(argsFor(keyWith([scope])))).toBe(true)
      })

      it(`denies ${op} on ${slug} when key lacks ${scope}`, async () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        // a non-empty but irrelevant scope set → default-deny
        expect(await access(argsFor(keyWith(['prayer-times:read'])))).toBe(false)
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
      it(`denies ${op} on ${slug} when key only has ${readScope}`, async () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(await access(argsFor(keyWith([readScope])))).toBe(false)
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
      it(`denies ${op} on read-only ${slug} even with that domain's read scope`, async () => {
        const readScope = slug === 'form-submissions' ? 'forms:read' : `${slug}:read`
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(await access(argsFor(keyWith([readScope])))).toBe(false)
      })
    }

    it('preserves a where-clause return from existing access on a newly mapped collection', async () => {
      const access = gateByApiKeyScope('members', 'read')(allowOwnTenant)
      const req = keyWith(['members:read'])
      ;(req.user as { tenant?: string }).tenant = 'abc'
      expect(await access(argsFor(req))).toEqual({ tenant: { equals: 'abc' } })
    })
  })
})

describe('scoped-key bootstrap carve-outs (/api/users/me + own tenant)', () => {
  const usersRead = gateByApiKeyScope('users', 'read')(Users.access?.read)
  const tenantsRead = gateByApiKeyScope('tenants', 'read')(Tenants.access?.read)
  const key = (extra: Record<string, unknown>) => ({
    _strategy: 'api-key',
    apiScopes: ['forms:read'],
    ...extra,
  })

  describe('users read → self only, composed with the real Users policy', () => {
    it('staff key: self only', async () => {
      const req = reqWith(key({ id: 42, role: 'staff', tenant: 4 }))
      expect(await usersRead(argsFor(req))).toEqual({ id: { equals: 42 } })
    })

    it('admin key: self only (never the whole tenant)', async () => {
      const req = reqWith(key({ id: 42, role: 'admin', tenant: 4 }))
      expect(await usersRead(argsFor(req))).toEqual({ id: { equals: 42 } })
    })

    it('platformOwner key: self only (never all users)', async () => {
      const req = reqWith(key({ id: 1, role: 'platformOwner' }))
      expect(await usersRead(argsFor(req))).toEqual({ id: { equals: 1 } })
    })

    it('role the Users policy denies stays denied', async () => {
      const req = reqWith(key({ id: 42, role: 'teacher', tenant: 4 }))
      expect(await usersRead(argsFor(req))).toBe(false)
    })

    it('fails closed when the user has no id', async () => {
      const req = reqWith(key({ role: 'staff', tenant: 4 }))
      expect(await usersRead(argsFor(req))).toBe(false)
    })

    it('still denies users create/update/delete for scoped keys', async () => {
      for (const op of ['create', 'update', 'delete'] as const) {
        const access = gateByApiKeyScope('users', op)(allow)
        expect(await access(argsFor(reqWith(key({ id: 42, role: 'admin', tenant: 4 }))))).toBe(false)
      }
    })

    it('leaves UI sessions and unscoped keys on the existing users read access', async () => {
      const access = gateByApiKeyScope('users', 'read')(allow)
      expect(await access(argsFor(reqWith({ id: 1, _strategy: 'local-jwt' })))).toBe(true)
      expect(await access(argsFor(reqWith({ id: 1, _strategy: 'api-key', apiScopes: [] })))).toBe(true)
    })
  })

  describe('tenants read → own tenant only', () => {
    it('tenant-bound key reads only its own tenant (unpopulated relation)', async () => {
      const req = reqWith(key({ id: 42, role: 'admin', tenant: 4 }))
      expect(await tenantsRead(argsFor(req))).toEqual({ id: { equals: 4 } })
    })

    it('tenant-bound key reads only its own tenant (populated relation)', async () => {
      const req = reqWith(key({ id: 42, role: 'staff', tenant: { id: 4, slug: 'mfllca' } }))
      expect(await tenantsRead(argsFor(req))).toEqual({ id: { equals: 4 } })
    })

    it('tenant-less platformOwner scoped key is denied (never "all tenants")', async () => {
      const req = reqWith(key({ id: 1, role: 'platformOwner' }))
      expect(await tenantsRead(argsFor(req))).toBe(false)
    })

    it('still denies tenants create/update/delete for scoped keys', async () => {
      for (const op of ['create', 'update', 'delete'] as const) {
        const access = gateByApiKeyScope('tenants', op)(allow)
        expect(await access(argsFor(reqWith(key({ id: 42, role: 'admin', tenant: 4 }))))).toBe(false)
      }
    })
  })

  describe('kiosk PIN field guard', () => {
    const fieldArgs = (user: Record<string, unknown> | null) =>
      ({ req: reqWith(user) }) as unknown as Parameters<typeof denyScopedApiKeyRead>[0]

    it('hides the PIN from scoped API keys', () => {
      expect(isScopedApiKey(reqWith(key({ id: 42 })))).toBe(true)
      expect(denyScopedApiKeyRead(fieldArgs(key({ id: 42 })))).toBe(false)
    })

    it('shows the PIN to UI sessions and unscoped keys', () => {
      expect(denyScopedApiKeyRead(fieldArgs({ id: 1, _strategy: 'local-jwt' }))).toBe(true)
      expect(denyScopedApiKeyRead(fieldArgs({ id: 1, _strategy: 'api-key', apiScopes: [] }))).toBe(true)
    })

    it('is wired onto tenants.checkinKiosk.pin', () => {
      const findPin = (fields: unknown[]): unknown => {
        for (const f of fields as Array<Record<string, unknown>>) {
          if (f.name === 'checkinKiosk') {
            return (f.fields as Array<Record<string, unknown>>).find((x) => x.name === 'pin')
          }
          if (Array.isArray(f.fields)) { const r = findPin(f.fields); if (r) return r }
          if (Array.isArray(f.tabs)) {
            for (const t of f.tabs as Array<Record<string, unknown>>) {
              const r = findPin(t.fields as unknown[]); if (r) return r
            }
          }
        }
        return undefined
      }
      const pin = findPin(Tenants.fields) as { access?: { read?: unknown } } | undefined
      expect(pin?.access?.read).toBe(denyScopedApiKeyRead)
    })
  })
})
