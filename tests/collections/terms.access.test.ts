import { describe, it, expect } from 'vitest'
import { Terms } from '@/collections/Terms'

const call = (op: string, user: any) =>
  (Terms.access as Record<string, any>)[op]({ req: { user } })

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
  it('school_admin writes within tenant', async () => {
    expect(await call('update', { role: 'school_admin', tenant: 3 })).toEqual({
      tenant: { equals: 3 },
    })
    expect(await call('create', { role: 'school_admin', tenant: 3 })).toBe(true)
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
