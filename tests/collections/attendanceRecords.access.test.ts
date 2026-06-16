import { describe, it, expect } from 'vitest'
import { AttendanceRecords } from '@/collections/AttendanceRecords'

const access = AttendanceRecords.access as Record<string, any>

describe('AttendanceRecords access', () => {
  it('teacher reads only own-class sessions', async () => {
    const find = async ({ collection }: any) =>
      collection === 'school-classes' ? { docs: [{ id: 11 }] } : { docs: [{ id: 301 }] }
    const req = { user: { id: 9, role: 'teacher', tenant: 1 }, payload: { find } }
    expect(await access.read({ req })).toEqual({ session: { in: [301] } })
  })
  it('teacher may create and update (ownership enforced by hook)', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(true)
    const find = async ({ collection }: any) =>
      collection === 'school-classes' ? { docs: [{ id: 11 }] } : { docs: [{ id: 301 }] }
    expect(
      await access.update({ req: { user: { id: 9, role: 'teacher', tenant: 1 }, payload: { find } } }),
    ).toEqual({ session: { in: [301] } })
  })
  it('teacher cannot delete', async () => {
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
  })
  it('staff read-only', async () => {
    expect(await access.read({ req: { user: { role: 'staff', tenant: 1 } } })).toEqual({
      tenant: { equals: 1 },
    })
    expect(await access.create({ req: { user: { role: 'staff', tenant: 1 } } })).toBe(false)
    expect(await access.update({ req: { user: { role: 'staff', tenant: 1 } } })).toBe(false)
  })
  it('admin can update (tenant-scoped)', async () => {
    expect(await access.update({ req: { user: { role: 'admin', tenant: 1 } } })).toEqual({
      tenant: { equals: 1 },
    })
  })
})
