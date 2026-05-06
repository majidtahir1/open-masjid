// tests/collections/forms.access.test.ts
import { describe, it, expect } from 'vitest'
import { Forms } from '@/collections/Forms'

const callAccess = (op: 'read'|'create'|'update'|'delete', user: any) =>
  (Forms.access![op] as Function)({ req: { user }, id: undefined })

describe('Forms access', () => {
  const tenant = { id: 't1' }
  const tenantUser = { id: 'u1', role: 'admin', tenant }
  it('blocks unauthenticated read', () => {
    expect(callAccess('read', null)).toBe(false)
  })
  it('returns tenant-scoped where for tenant users', () => {
    expect(callAccess('read', tenantUser)).toEqual({ tenant: { equals: 't1' } })
  })
  it('returns true for platformOwner', () => {
    expect(callAccess('read', { id: 'p', role: 'platformOwner' })).toBe(true)
  })
})
