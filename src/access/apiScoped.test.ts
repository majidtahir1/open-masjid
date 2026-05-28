import { describe, expect, it } from 'vitest'
import type { Access, PayloadRequest } from 'payload'

import { isApiKeyAuth, requireScope } from './apiScoped'

const reqWith = (user: Record<string, unknown> | null): PayloadRequest =>
  ({ user } as unknown as PayloadRequest)

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
const allowOwnTenant: Access = ({ req }) => {
  const user = req.user as { tenant?: string } | null
  if (!user) return false
  return { tenant: { equals: user.tenant } } as unknown as ReturnType<Access>
}
const deny: Access = () => false

const argsFor = (req: PayloadRequest): Parameters<Access>[0] =>
  ({ req } as unknown as Parameters<Access>[0])

describe('requireScope', () => {
  const guard = requireScope('prayer-times:write')

  it('passes through to existing access for UI sessions (no scope check)', () => {
    const access = guard(allow)
    const req = reqWith({ id: 1, _strategy: 'local-jwt', apiScopes: [] })
    expect(access(argsFor(req))).toBe(true)
  })

  it('passes through for UI sessions even when existing access denies', () => {
    const access = guard(deny)
    const req = reqWith({ id: 1, _strategy: 'local-jwt' })
    expect(access(argsFor(req))).toBe(false)
  })

  it('passes through for API key auth with empty scopes (back-compat)', () => {
    const access = guard(allow)
    const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: [] })
    expect(access(argsFor(req))).toBe(true)
  })

  it('passes through for API key auth with no apiScopes field (back-compat)', () => {
    const access = guard(allow)
    const req = reqWith({ id: 1, _strategy: 'api-key' })
    expect(access(argsFor(req))).toBe(true)
  })

  it('passes through for API key auth when scope is present', () => {
    const access = guard(allow)
    const req = reqWith({
      id: 1,
      _strategy: 'api-key',
      apiScopes: ['prayer-times:read', 'prayer-times:write'],
    })
    expect(access(argsFor(req))).toBe(true)
  })

  it('denies for API key auth when scope is missing', () => {
    const access = guard(allow)
    const req = reqWith({
      id: 1,
      _strategy: 'api-key',
      apiScopes: ['prayer-times:read'],
    })
    expect(access(argsFor(req))).toBe(false)
  })

  it('still denies when scope is present but existing access denies (tenant scoping wins)', () => {
    const access = guard(deny)
    const req = reqWith({
      id: 1,
      _strategy: 'api-key',
      apiScopes: ['prayer-times:write'],
    })
    expect(access(argsFor(req))).toBe(false)
  })

  it('preserves where-clause returns from existing access', () => {
    const access = guard(allowOwnTenant)
    const req = reqWith({
      id: 1,
      _strategy: 'api-key',
      apiScopes: ['prayer-times:write'],
      tenant: 'abc',
    })
    expect(access(argsFor(req))).toEqual({ tenant: { equals: 'abc' } })
  })
})
