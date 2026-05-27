import { describe, it, expect } from 'vitest'
import { setTenantFromUser } from '@/hooks/setTenantFromUser'

function call(args: { data: Record<string, unknown>; user: unknown; operation?: 'create' | 'update' }) {
  return setTenantFromUser({
    data: args.data,
    operation: args.operation ?? 'create',
    req: { user: args.user } as never,
  } as never)
}

describe('setTenantFromUser', () => {
  it('forces a tenant admin\'s submitted (forged) tenant to their own on create', () => {
    const out = call({
      data: { email: 'x@y.com', role: 'admin', tenant: 999 }, // forged victim tenant
      user: { role: 'admin', tenant: 7 },
    })
    expect((out as { tenant?: unknown }).tenant).toBe(7)
  })

  it('resolves the user tenant when it is a populated object', () => {
    const out = call({
      data: { tenant: 999 },
      user: { role: 'admin', tenant: { id: 42 } },
    })
    expect((out as { tenant?: unknown }).tenant).toBe(42)
  })

  it('leaves data untouched for platformOwner (can target any tenant)', () => {
    const out = call({
      data: { tenant: 5 },
      user: { role: 'platformOwner', tenant: null },
    })
    expect((out as { tenant?: unknown }).tenant).toBe(5)
  })

  it('leaves data untouched when there is no authenticated user (server/overrideAccess path)', () => {
    const out = call({ data: { tenant: 5 }, user: null })
    expect((out as { tenant?: unknown }).tenant).toBe(5)
  })

  it('is a no-op on update', () => {
    const out = call({ data: { tenant: 999 }, user: { role: 'admin', tenant: 7 }, operation: 'update' })
    expect((out as { tenant?: unknown }).tenant).toBe(999)
  })
})
