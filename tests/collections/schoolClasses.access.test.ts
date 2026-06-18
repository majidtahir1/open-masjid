import { describe, it, expect } from 'vitest'
import { SchoolClasses } from '@/collections/SchoolClasses'

const access = SchoolClasses.access as Record<string, any>

function reqWith(user: any, byCollection: Record<string, any[]> = {}) {
  return { user, payload: { find: async ({ collection }: any) => ({ docs: byCollection[collection] ?? [] }) } } as any
}

describe('SchoolClasses access', () => {
  it('admin reads tenant-scoped', async () => {
    expect(await access.read({ req: { user: { role: 'admin', tenant: 2 } } })).toEqual({
      tenant: { equals: 2 },
    })
  })
  it('teacher reads only their class ids', async () => {
    const req = reqWith({ id: 9, role: 'teacher', tenant: 2 }, { 'school-classes': [{ id: 41 }, { id: 42 }] })
    expect(await access.read({ req })).toEqual({ id: { in: [41, 42] } })
  })
  it('teacher cannot create or delete', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 2 } } })).toBe(false)
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 2 } } })).toBe(false)
  })
  it('school_admin read scoped to managed programs (by term)', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 2, managedPrograms: [10] })
    expect(await access.read({ req })).toEqual({ term: { in: [10] } })
  })
  it('school_admin create allowed with managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 2, managedPrograms: [10] })
    expect(await access.create({ req })).toBe(true)
  })
  it('school_admin create denied without managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 2, managedPrograms: [] })
    expect(await access.create({ req })).toBe(false)
  })
  it('school_admin delete scoped to managed programs (by term)', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 2, managedPrograms: [10] })
    expect(await access.delete({ req })).toEqual({ term: { in: [10] } })
  })
})
