import { describe, it, expect } from 'vitest'
import { Members } from '@/collections/Members'

function call(op: 'read' | 'create' | 'update' | 'delete', user: any) {
  const fn = (Members.access as any)[op]
  return fn({ req: { user } })
}

describe('Members access', () => {
  it('platformOwner reads all', () => {
    expect(call('read', { role: 'platformOwner' })).toBe(true)
  })
  it('admin reads/updates own tenant only', () => {
    expect(call('read', { role: 'admin', tenant: 1 })).not.toBe(false)
    expect(call('update', { role: 'admin', tenant: 1 })).not.toBe(false)
  })
  it('staff cannot read members', () => {
    expect(call('read', { role: 'staff', tenant: 1 })).toBe(false)
  })
  it('create is forbidden in admin (webhooks use overrideAccess)', () => {
    for (const u of [{ role: 'platformOwner' }, { role: 'admin', tenant: 1 }, { role: 'staff', tenant: 1 }, undefined]) {
      expect(call('create', u)).toBe(false)
    }
  })
  it('delete forbidden for everyone', () => {
    for (const u of [{ role: 'platformOwner' }, { role: 'admin', tenant: 1 }, undefined]) {
      expect(call('delete', u)).toBe(false)
    }
  })
})
