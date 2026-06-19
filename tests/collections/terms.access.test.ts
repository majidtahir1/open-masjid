import { describe, it, expect } from 'vitest'
import { Terms } from '@/collections/Terms'

const access = Terms.access as Record<string, any>

function reqWith(user: any, byCollection: Record<string, any[]> = {}) {
  return { user, payload: { find: async ({ collection }: any) => ({ docs: byCollection[collection] ?? [] }) } } as any
}

const call = (op: string, user: any) =>
  access[op]({ req: { user } })

describe('Terms access', () => {
  it('denies anonymous on every op', async () => {
    for (const op of ['read', 'create', 'update', 'delete']) {
      expect(await call(op, undefined)).toBe(false)
    }
  })
  it('platformOwner full access', async () => {
    for (const op of ['read', 'create', 'update', 'delete']) {
      expect(await call(op, { role: 'platformOwner' })).toBe(true)
    }
  })
  it('school_admin read scoped to managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 3, managedPrograms: [10] })
    expect(await access.read({ req })).toEqual({ id: { in: [10] } })
  })
  it('school_admin update scoped to managed programs', async () => {
    const req = reqWith({ role: 'school_admin', tenant: 3, managedPrograms: [10] })
    expect(await access.update({ req })).toEqual({ id: { in: [10] } })
  })
  it('school_admin create denied (adminOnlyCreate)', async () => {
    expect(await call('create', { role: 'school_admin', tenant: 3, managedPrograms: [10] })).toBe(false)
  })
  it('admin create allowed', async () => {
    expect(await call('create', { role: 'admin', tenant: 3 })).toBe(true)
  })
  it('teacher reads within tenant but cannot write', async () => {
    expect(await call('read', { role: 'teacher', tenant: 3 })).toEqual({ tenant: { equals: 3 } })
    expect(await call('create', { role: 'teacher', tenant: 3 })).toBe(false)
    expect(await call('update', { role: 'teacher', tenant: 3 })).toBe(false)
  })
  it('kioskManager denied', async () => {
    expect(await call('read', { role: 'kioskManager', tenant: 3 })).toBe(false)
  })
})
