import { describe, it, expect } from 'vitest'
import { schoolTenantRead, schoolTenantWrite } from '@/access/schoolAccess'

const call = (fn: any, user: any) => fn({ req: { user } })

describe('schoolTenantRead', () => {
  it('denies anonymous', () => {
    expect(call(schoolTenantRead, undefined)).toBe(false)
  })
  it('platformOwner sees all', () => {
    expect(call(schoolTenantRead, { role: 'platformOwner' })).toBe(true)
  })
  it('admin, school_admin, and staff are scoped to their tenant', () => {
    for (const role of ['admin', 'school_admin', 'staff']) {
      expect(call(schoolTenantRead, { role, tenant: 5 })).toEqual({ tenant: { equals: 5 } })
    }
  })
  it('tenant object id is resolved', () => {
    expect(call(schoolTenantRead, { role: 'admin', tenant: { id: 9 } })).toEqual({
      tenant: { equals: 9 },
    })
  })
  it('user without tenant denied', () => {
    expect(call(schoolTenantRead, { role: 'admin' })).toBe(false)
  })
})

describe('schoolTenantWrite', () => {
  it('platformOwner true', () => {
    expect(call(schoolTenantWrite, { role: 'platformOwner' })).toBe(true)
  })
  it('admin and school_admin write within tenant; staff and teacher cannot', () => {
    expect(call(schoolTenantWrite, { role: 'admin', tenant: 5 })).toEqual({ tenant: { equals: 5 } })
    expect(call(schoolTenantWrite, { role: 'school_admin', tenant: 5 })).toEqual({
      tenant: { equals: 5 },
    })
    expect(call(schoolTenantWrite, { role: 'staff', tenant: 5 })).toBe(false)
    expect(call(schoolTenantWrite, { role: 'teacher', tenant: 5 })).toBe(false)
  })
})
