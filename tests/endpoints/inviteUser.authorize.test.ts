import { describe, it, expect } from 'vitest'
import { authorizeInvite } from '@/endpoints/inviteUser'

describe('authorizeInvite', () => {
  it('rejects callers who are not platformOwner/admin/school_admin', () => {
    expect(authorizeInvite({ actingRole: 'staff', actingTenant: 1 }, { role: 'teacher', tenant: 1 }).ok).toBe(false)
    expect(authorizeInvite({ actingRole: 'teacher', actingTenant: 1 }, { role: 'teacher', tenant: 1 }).ok).toBe(false)
  })
  it('platformOwner can invite any role, forcing tenant null for platformOwner target', () => {
    expect(authorizeInvite({ actingRole: 'platformOwner', actingTenant: null }, { role: 'admin', tenant: 5 })).toEqual({
      ok: true,
      targetTenant: 5,
    })
    expect(authorizeInvite({ actingRole: 'platformOwner', actingTenant: null }, { role: 'platformOwner', tenant: 5 })).toEqual({
      ok: true,
      targetTenant: null,
    })
  })
  it('admin and school_admin can invite teacher/staff into THEIR OWN tenant (ignoring supplied tenant)', () => {
    for (const actingRole of ['admin', 'school_admin'] as const) {
      expect(authorizeInvite({ actingRole, actingTenant: 7 }, { role: 'teacher', tenant: 99 })).toEqual({
        ok: true,
        targetTenant: 7,
      })
      expect(authorizeInvite({ actingRole, actingTenant: 7 }, { role: 'staff', tenant: 99 })).toEqual({
        ok: true,
        targetTenant: 7,
      })
    }
  })
  it('admin and school_admin CANNOT invite elevated roles', () => {
    for (const actingRole of ['admin', 'school_admin'] as const) {
      for (const role of ['platformOwner', 'admin', 'school_admin'] as const) {
        const r = authorizeInvite({ actingRole, actingTenant: 7 }, { role, tenant: 7 })
        if (r.ok) throw new Error('expected ok:false')
        expect(r.ok).toBe(false)
        expect(r.status).toBe(403)
      }
    }
  })
  it('admin/school_admin with no tenant is rejected', () => {
    expect(authorizeInvite({ actingRole: 'admin', actingTenant: null }, { role: 'teacher', tenant: 1 }).ok).toBe(false)
  })
  it('missing role is a 400', () => {
    const r = authorizeInvite({ actingRole: 'platformOwner', actingTenant: null }, { role: undefined, tenant: 1 })
    if (r.ok) throw new Error('expected ok:false')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })
})
