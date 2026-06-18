import { describe, it, expect } from 'vitest'
import { Enrollments } from '@/collections/Enrollments'

const access = Enrollments.access as Record<string, any>

function reqWith(user: any, byCollection: Record<string, any[]> = {}) {
  return { user, payload: { find: async ({ collection }: any) => ({ docs: byCollection[collection] ?? [] }) } } as any
}

describe('Enrollments access', () => {
  it('teacher reads only enrollments in their classes', async () => {
    const req = reqWith({ id: 9, role: 'teacher', tenant: 1 }, { 'school-classes': [{ id: 11 }] })
    expect(await access.read({ req })).toEqual({ class: { in: [11] } })
  })
  it('teacher cannot create enrollments', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
  })
  it('school_admin create allowed with managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 1, managedPrograms: [10] })
    expect(await access.create({ req })).toBe(true)
  })
  it('school_admin create denied without managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 1, managedPrograms: [] })
    expect(await access.create({ req })).toBe(false)
  })
  it('school_admin delete scoped to managed programs (by class)', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 1, managedPrograms: [10] }, { 'school-classes': [{ id: 41 }] })
    expect(await access.delete({ req })).toEqual({ class: { in: [41] } })
  })
})
