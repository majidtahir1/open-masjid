import { describe, it, expect } from 'vitest'
import { SchoolClasses } from '@/collections/SchoolClasses'

const access = SchoolClasses.access as Record<string, any>
const findStub = (docs: any[]) => async () => ({ docs })

describe('SchoolClasses access', () => {
  it('admin reads tenant-scoped', async () => {
    expect(await access.read({ req: { user: { role: 'admin', tenant: 2 } } })).toEqual({
      tenant: { equals: 2 },
    })
  })
  it('teacher reads only their class ids', async () => {
    const req = {
      user: { id: 9, role: 'teacher', tenant: 2 },
      payload: { find: findStub([{ id: 41 }, { id: 42 }]) },
    }
    expect(await access.read({ req })).toEqual({ id: { in: [41, 42] } })
  })
  it('teacher cannot create or delete', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 2 } } })).toBe(false)
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 2 } } })).toBe(false)
  })
})
