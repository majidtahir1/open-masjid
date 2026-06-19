import { describe, it, expect } from 'vitest'
import { assertClassProgramScope } from '@/hooks/assertProgramScope'
import { assertSessionScope } from '@/hooks/assertTeacherOwnsSession'

const t = (() => {}) as any

describe('assertClassProgramScope', () => {
  it('allows a school_admin to create a class in a managed program', () => {
    const data = { term: 10 }
    expect(assertClassProgramScope({ data, req: { user: { role: 'school_admin', managedPrograms: [10] }, t } } as any)).toBe(data)
  })
  it('blocks a class in an unmanaged program', () => {
    expect(() => assertClassProgramScope({ data: { term: 99 }, req: { user: { role: 'school_admin', managedPrograms: [10] }, t } } as any)).toThrow()
  })
  it('ignores non-school_admin', () => {
    const data = { term: 99 }
    expect(assertClassProgramScope({ data, req: { user: { role: 'admin' }, t } } as any)).toBe(data)
  })
})

describe("assertSessionScope (school_admin)", () => {
  const findByID = (term: any) => async () => ({ class: { term, teachers: [] } })
  it("allows when the session's program is managed", async () => {
    const req = { user: { role: 'school_admin', managedPrograms: [10] }, t, payload: { findByID: findByID(10) } } as any
    await expect(assertSessionScope({ data: { session: 5 }, req } as any)).resolves.toEqual({ session: 5 })
  })
  it("blocks when the session's program is not managed", async () => {
    const req = { user: { role: 'school_admin', managedPrograms: [10] }, t, payload: { findByID: findByID(99) } } as any
    await expect(assertSessionScope({ data: { session: 5 }, req } as any)).rejects.toThrow()
  })
})
