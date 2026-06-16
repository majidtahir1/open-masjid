import { describe, it, expect } from 'vitest'
import { ClassSessions } from '@/collections/ClassSessions'

const access = ClassSessions.access as Record<string, any>
const teacherReq = {
  user: { id: 9, role: 'teacher', tenant: 1 },
  payload: { find: async () => ({ docs: [{ id: 11 }] }) },
}

describe('ClassSessions access', () => {
  it('teacher reads + updates own classes sessions', async () => {
    expect(await access.read({ req: teacherReq })).toEqual({ class: { in: [11] } })
    expect(await access.update({ req: teacherReq })).toEqual({ class: { in: [11] } })
  })
  it('teacher cannot create or delete sessions', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
  })
  it('school_admin tenant CRUD', async () => {
    expect(await access.create({ req: { user: { role: 'school_admin', tenant: 1 } } })).toBe(true)
  })
})
