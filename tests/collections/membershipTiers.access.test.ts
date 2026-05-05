import { describe, it, expect } from 'vitest'
import { MembershipTiers } from '@/collections/MembershipTiers'

function callAccess(op: 'read' | 'create' | 'update' | 'delete', user: any) {
  const access = MembershipTiers.access as Record<string, any>
  return access[op]({ req: { user } })
}

describe('MembershipTiers access', () => {
  it('platformOwner can do everything', () => {
    const u = { role: 'platformOwner' }
    expect(callAccess('read', u)).toBe(true)
    expect(callAccess('create', u)).toBe(true)
    expect(callAccess('update', u)).toBe(true)
  })

  it('admin can read/create/update within their tenant', () => {
    const admin = { role: 'admin', tenant: 1 }
    expect(callAccess('read', admin)).not.toBe(false)
    expect(callAccess('create', admin)).not.toBe(false)
    expect(callAccess('update', admin)).not.toBe(false)
  })

  it('staff can only read', () => {
    const staff = { role: 'staff', tenant: 1 }
    expect(callAccess('read', staff)).not.toBe(false)
    expect(callAccess('create', staff)).toBe(false)
    expect(callAccess('update', staff)).toBe(false)
  })

  it('hard delete is forbidden for everyone', () => {
    for (const u of [{ role: 'platformOwner' }, { role: 'admin', tenant: 1 }, { role: 'staff', tenant: 1 }, undefined]) {
      expect(callAccess('delete', u)).toBe(false)
    }
  })

  it('anonymous gets nothing', () => {
    expect(callAccess('read', undefined)).toBe(false)
    expect(callAccess('create', undefined)).toBe(false)
  })
})
