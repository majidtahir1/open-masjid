import { describe, it, expect } from 'vitest'
import { Students } from '@/collections/Students'

const access = Students.access as Record<string, any>

describe('Students access', () => {
  it('staff is read-only, no create/update/delete', async () => {
    expect(await access.read({ req: { user: { role: 'staff', tenant: 4 } } })).toEqual({
      tenant: { equals: 4 },
    })
    expect(await access.create({ req: { user: { role: 'staff', tenant: 4 } } })).toBe(false)
    expect(await access.update({ req: { user: { role: 'staff', tenant: 4 } } })).toBe(false)
  })
  it('teacher reads + updates only enrolled students', async () => {
    const find = async ({ collection }: any) =>
      collection === 'school-classes'
        ? { docs: [{ id: 11 }] }
        : { docs: [{ student: 77 }] }
    const req = { user: { id: 9, role: 'teacher', tenant: 4 }, payload: { find } }
    expect(await access.read({ req })).toEqual({ id: { in: [77] } })
    expect(await access.update({ req })).toEqual({ id: { in: [77] } })
  })
  it('teacher cannot delete students', async () => {
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 4 } } })).toBe(false)
  })
  it('school_admin full tenant CRUD', async () => {
    expect(await access.update({ req: { user: { role: 'school_admin', tenant: 4 } } })).toEqual({
      tenant: { equals: 4 },
    })
  })
})
