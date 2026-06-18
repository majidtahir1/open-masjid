import { describe, it, expect } from 'vitest'
import {
  managedProgramIds, schoolAdminTermsRead, schoolAdminClassesRead, schoolAdminSessionsRead,
  schoolAdminStudentsRead, readByRole, writeByRole, schoolAdminCreate, adminOnlyCreate,
} from '@/access/schoolAccess'

const sa = (managed: any[]) => ({ id: 9, role: 'school_admin', tenant: 1, managedPrograms: managed })
function reqWith(user: any, byCollection: Record<string, any[]> = {}) {
  return { user, payload: { find: async ({ collection }: any) => ({ docs: byCollection[collection] ?? [] }) } } as any
}

describe('managedProgramIds', () => {
  it('normalizes ids and objects', () => {
    expect(managedProgramIds({ managedPrograms: [10, { id: 11 }] })).toEqual([10, 11])
  })
  it('empty when none', () => {
    expect(managedProgramIds({})).toEqual([])
  })
})

describe('school_admin resolvers', () => {
  it('terms read scoped to managed program ids', async () => {
    expect(await schoolAdminTermsRead(reqWith(sa([10, 11])))).toEqual({ id: { in: [10, 11] } })
  })
  it('classes read scoped by term', async () => {
    expect(await schoolAdminClassesRead(reqWith(sa([10])))).toEqual({ term: { in: [10] } })
  })
  it("sessions read scoped by the programs' classes", async () => {
    const req = reqWith(sa([10]), { 'school-classes': [{ id: 41 }, { id: 42 }] })
    expect(await schoolAdminSessionsRead(req)).toEqual({ class: { in: [41, 42] } })
  })
  it('students read = enrolled in their classes OR registered for their programs', async () => {
    const req = reqWith(sa([10]), { 'school-classes': [{ id: 41 }], enrollments: [{ student: 77 }] })
    expect(await schoolAdminStudentsRead(req)).toEqual({ or: [{ id: { in: [77] } }, { registeredProgram: { in: [10] } }] })
  })
  it('empty managed → matches nothing', async () => {
    expect(await schoolAdminTermsRead(reqWith(sa([])))).toEqual({ id: { in: [] } })
  })
})

describe('readByRole / writeByRole', () => {
  const teacherRes = async () => ({ id: { in: [1] } })
  const saRes = async () => ({ id: { in: [2] } })
  const read = readByRole({ teacher: teacherRes, schoolAdmin: saRes })
  const write = writeByRole({ schoolAdmin: saRes })
  it('platformOwner → true', async () => {
    expect(await read({ req: { user: { role: 'platformOwner' } } } as any)).toBe(true)
  })
  it('teacher → teacher resolver', async () => {
    expect(await read({ req: { user: { role: 'teacher', tenant: 1 } } } as any)).toEqual({ id: { in: [1] } })
  })
  it('school_admin → schoolAdmin resolver', async () => {
    expect(await read({ req: { user: { role: 'school_admin', tenant: 1 } } } as any)).toEqual({ id: { in: [2] } })
  })
  it('admin → tenant read', async () => {
    expect(await read({ req: { user: { role: 'admin', tenant: 1 } } } as any)).toEqual({ tenant: { equals: 1 } })
  })
  it('staff → tenant read but write denied', async () => {
    expect(await read({ req: { user: { role: 'staff', tenant: 1 } } } as any)).toEqual({ tenant: { equals: 1 } })
    expect(await write({ req: { user: { role: 'staff', tenant: 1 } } } as any)).toBe(false)
  })
  it('write: school_admin → resolver, admin → tenant', async () => {
    expect(await write({ req: { user: { role: 'school_admin', tenant: 1 } } } as any)).toEqual({ id: { in: [2] } })
    expect(await write({ req: { user: { role: 'admin', tenant: 1 } } } as any)).toEqual({ tenant: { equals: 1 } })
  })
})

describe('create gates', () => {
  it('adminOnlyCreate: admin/platformOwner yes, school_admin no', () => {
    expect(adminOnlyCreate({ req: { user: { role: 'platformOwner' } } } as any)).toBe(true)
    expect(adminOnlyCreate({ req: { user: { role: 'admin', tenant: 1 } } } as any)).toBe(true)
    expect(adminOnlyCreate({ req: { user: sa([10]) } } as any)).toBe(false)
  })
  it('schoolAdminCreate: school_admin only with managed programs', () => {
    expect(schoolAdminCreate({ req: { user: sa([10]) } } as any)).toBe(true)
    expect(schoolAdminCreate({ req: { user: sa([]) } } as any)).toBe(false)
    expect(schoolAdminCreate({ req: { user: { role: 'admin', tenant: 1 } } } as any)).toBe(true)
  })
})
