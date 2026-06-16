import { describe, it, expect } from 'vitest'
import { Enrollments } from '@/collections/Enrollments'

const access = Enrollments.access as Record<string, any>

describe('Enrollments access', () => {
  it('teacher reads only enrollments in their classes', async () => {
    const req = {
      user: { id: 9, role: 'teacher', tenant: 1 },
      payload: { find: async () => ({ docs: [{ id: 11 }] }) },
    }
    expect(await access.read({ req })).toEqual({ class: { in: [11] } })
  })
  it('teacher cannot create enrollments', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
  })
  it('school_admin tenant CRUD', async () => {
    expect(await access.create({ req: { user: { role: 'school_admin', tenant: 1 } } })).toBe(true)
    expect(await access.delete({ req: { user: { role: 'school_admin', tenant: 1 } } })).toEqual({
      tenant: { equals: 1 },
    })
  })
})
