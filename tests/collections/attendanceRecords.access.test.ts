import { describe, it, expect } from 'vitest'
import { AttendanceRecords } from '@/collections/AttendanceRecords'

const access = AttendanceRecords.access as Record<string, any>

function reqWith(user: any, byCollection: Record<string, any[]> = {}) {
  return { user, payload: { find: async ({ collection }: any) => ({ docs: byCollection[collection] ?? [] }) } } as any
}

describe('AttendanceRecords access', () => {
  it('teacher reads only own-class sessions', async () => {
    const req = reqWith({ id: 9, role: 'teacher', tenant: 1 }, { 'school-classes': [{ id: 11 }], 'class-sessions': [{ id: 301 }] })
    expect(await access.read({ req })).toEqual({ session: { in: [301] } })
  })
  it('teacher may create and update (ownership enforced by hook)', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(true)
    const req = reqWith({ id: 9, role: 'teacher', tenant: 1 }, { 'school-classes': [{ id: 11 }], 'class-sessions': [{ id: 301 }] })
    expect(await access.update({ req })).toEqual({ session: { in: [301] } })
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
  it('school_admin read scoped to managed programs (by session)', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 1, managedPrograms: [10] }, { 'school-classes': [{ id: 41 }], 'class-sessions': [{ id: 301 }] })
    expect(await access.read({ req })).toEqual({ session: { in: [301] } })
  })
  it('school_admin create allowed with managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 1, managedPrograms: [10] })
    expect(await access.create({ req })).toBe(true)
  })
  it('school_admin create denied without managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 1, managedPrograms: [] })
    expect(await access.create({ req })).toBe(false)
  })
  it('school_admin delete scoped to managed programs (by session)', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 1, managedPrograms: [10] }, { 'school-classes': [{ id: 41 }], 'class-sessions': [{ id: 301 }] })
    expect(await access.delete({ req })).toEqual({ session: { in: [301] } })
  })
})
