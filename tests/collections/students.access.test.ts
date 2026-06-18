import { describe, it, expect } from 'vitest'
import { Students } from '@/collections/Students'

const access = Students.access as Record<string, any>

function reqWith(user: any, byCollection: Record<string, any[]> = {}) {
  return { user, payload: { find: async ({ collection }: any) => ({ docs: byCollection[collection] ?? [] }) } } as any
}

describe('Students access', () => {
  it('staff is read-only, no create/update/delete', async () => {
    expect(await access.read({ req: { user: { role: 'staff', tenant: 4 } } })).toEqual({
      tenant: { equals: 4 },
    })
    expect(await access.create({ req: { user: { role: 'staff', tenant: 4 } } })).toBe(false)
    expect(await access.update({ req: { user: { role: 'staff', tenant: 4 } } })).toBe(false)
  })
  it('teacher reads + updates only enrolled students', async () => {
    const req = reqWith({ id: 9, role: 'teacher', tenant: 4 }, { 'school-classes': [{ id: 11 }], enrollments: [{ student: 77 }] })
    expect(await access.read({ req })).toEqual({ id: { in: [77] } })
    expect(await access.update({ req })).toEqual({ id: { in: [77] } })
  })
  it('teacher cannot delete students', async () => {
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 4 } } })).toBe(false)
  })
  it('school_admin read scoped to managed programs (enrolled + registered)', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 4, managedPrograms: [10] }, { 'school-classes': [{ id: 41 }], enrollments: [{ student: 77 }] })
    expect(await access.read({ req })).toEqual({ or: [{ id: { in: [77] } }, { registeredProgram: { in: [10] } }] })
  })
  it('school_admin update scoped to managed programs (enrolled + registered)', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 4, managedPrograms: [10] }, { 'school-classes': [{ id: 41 }], enrollments: [{ student: 77 }] })
    expect(await access.update({ req })).toEqual({ or: [{ id: { in: [77] } }, { registeredProgram: { in: [10] } }] })
  })
  it('school_admin create allowed with managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 4, managedPrograms: [10] })
    expect(await access.create({ req })).toBe(true)
  })
  it('school_admin create denied without managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 4, managedPrograms: [] })
    expect(await access.create({ req })).toBe(false)
  })
})
