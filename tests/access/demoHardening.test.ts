import { describe, it, expect, vi } from 'vitest'
import { validateApiScopes } from '@/collections/Users'
import { actingUserInDemoTenant } from '@/access/demoTenant'

describe('validateApiScopes (Fix #1: no self-granted platform blog scopes)', () => {
  it('rejects blog:write for a non-platformOwner', () => {
    expect(validateApiScopes(['blog:write'], { role: 'admin' })).toMatch(/platform owner/i)
  })
  it('rejects blog:read for a non-platformOwner', () => {
    expect(validateApiScopes(['announcements:read', 'blog:read'], { role: 'admin' })).toMatch(
      /platform owner/i,
    )
  })
  it('allows blog scopes for a platformOwner', () => {
    expect(validateApiScopes(['blog:write'], { role: 'platformOwner' })).toBe(true)
  })
  it('allows tenant-scoped scopes for a non-platformOwner', () => {
    expect(validateApiScopes(['prayer-times:write', 'announcements:write'], { role: 'admin' })).toBe(
      true,
    )
  })
  it('allows empty / non-array values', () => {
    expect(validateApiScopes([], { role: 'admin' })).toBe(true)
    expect(validateApiScopes(undefined, { role: 'admin' })).toBe(true)
    expect(validateApiScopes(null, null)).toBe(true)
  })
})

describe('actingUserInDemoTenant (Fix #2: lock demo admin user-writes)', () => {
  function req(user: unknown, tenantDoc: unknown) {
    return {
      user,
      payload: { findByID: vi.fn(async () => tenantDoc) },
    } as never
  }

  it('is false for platformOwner (no tenant lookup)', async () => {
    const r = req({ role: 'platformOwner' }, { demoMode: true })
    expect(await actingUserInDemoTenant(r)).toBe(false)
  })
  it('is false when there is no user', async () => {
    expect(await actingUserInDemoTenant(req(null, null))).toBe(false)
  })
  it('is true for an admin whose tenant is demoMode', async () => {
    expect(await actingUserInDemoTenant(req({ role: 'admin', tenant: 10 }, { demoMode: true }))).toBe(
      true,
    )
  })
  it('is false for an admin whose tenant is not demoMode', async () => {
    expect(
      await actingUserInDemoTenant(req({ role: 'admin', tenant: 2 }, { demoMode: false })),
    ).toBe(false)
  })
  it('handles a populated tenant relationship object', async () => {
    expect(
      await actingUserInDemoTenant(req({ role: 'admin', tenant: { id: 10 } }, { demoMode: true })),
    ).toBe(true)
  })
  it('is false when the admin has no tenant', async () => {
    expect(await actingUserInDemoTenant(req({ role: 'admin' }, { demoMode: true }))).toBe(false)
  })
  it('fails closed (false) if the tenant lookup throws', async () => {
    const r = {
      user: { role: 'admin', tenant: 10 },
      payload: {
        findByID: vi.fn(async () => {
          throw new Error('db down')
        }),
      },
    } as never
    expect(await actingUserInDemoTenant(r)).toBe(false)
  })
})
