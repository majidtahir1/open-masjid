import { describe, it, expect } from 'vitest'
import { schoolTenantRead, schoolTenantWrite } from '@/access/schoolAccess'
import {
  teacherClassesRead,
  teacherSessionsRead,
  teacherEnrollmentsRead,
  teacherStudentsRead,
  teacherAttendanceRead,
} from '@/access/schoolAccess'

/** Build a mock req whose payload.find returns canned docs per collection. */
function mockReq(user: any, byCollection: Record<string, any[]>) {
  return {
    user,
    payload: {
      find: async ({ collection }: { collection: string }) => ({
        docs: byCollection[collection] ?? [],
      }),
    },
  } as any
}

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

describe('teacher async scoping', () => {
  const teacher = { id: 100, role: 'teacher', tenant: 5 }

  it('non-teacher falls through to schoolTenantRead', async () => {
    const admin = { role: 'admin', tenant: 5 }
    expect(await teacherClassesRead({ req: mockReq(admin, {}) })).toEqual({
      tenant: { equals: 5 },
    })
  })

  it('teacher classes scoped to ids where they teach', async () => {
    const req = mockReq(teacher, { 'school-classes': [{ id: 11 }, { id: 12 }] })
    expect(await teacherClassesRead({ req })).toEqual({ id: { in: [11, 12] } })
  })

  it('teacher with no classes is denied (empty in-list)', async () => {
    const req = mockReq(teacher, { 'school-classes': [] })
    expect(await teacherClassesRead({ req })).toEqual({ id: { in: [] } })
  })

  it('teacher sessions scoped by class', async () => {
    const req = mockReq(teacher, { 'school-classes': [{ id: 11 }] })
    expect(await teacherSessionsRead({ req })).toEqual({ class: { in: [11] } })
  })

  it('teacher enrollments scoped by class', async () => {
    const req = mockReq(teacher, { 'school-classes': [{ id: 11 }] })
    expect(await teacherEnrollmentsRead({ req })).toEqual({ class: { in: [11] } })
  })

  it('teacher students scoped to enrolled student ids', async () => {
    const req = mockReq(teacher, {
      'school-classes': [{ id: 11 }],
      enrollments: [{ student: 201 }, { student: { id: 202 } }],
    })
    expect(await teacherStudentsRead({ req })).toEqual({ id: { in: [201, 202] } })
  })

  it('teacher attendance scoped to own sessions', async () => {
    const req = mockReq(teacher, {
      'school-classes': [{ id: 11 }],
      'class-sessions': [{ id: 301 }, { id: 302 }],
    })
    expect(await teacherAttendanceRead({ req })).toEqual({ session: { in: [301, 302] } })
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
