import { describe, it, expect } from 'vitest'
import { Donations } from '@/collections/Donations'

/**
 * Donations is read-only from the admin: create/update/delete must always
 * return false. Reads are tenant-scoped (platformOwner sees all). The
 * webhook writes via overrideAccess.
 */

function callAccess(op: 'read' | 'create' | 'update' | 'delete', user: any) {
  const access = Donations.access as Record<string, any>
  const fn = access[op]
  return fn({ req: { user } })
}

describe('Donations access', () => {
  it('forbids create/update/delete for everyone (including platformOwner)', () => {
    const owner = { role: 'platformOwner' }
    const admin = { role: 'admin', tenant: 1 }
    for (const u of [owner, admin, undefined]) {
      expect(callAccess('create', u)).toBe(false)
      expect(callAccess('update', u)).toBe(false)
      expect(callAccess('delete', u)).toBe(false)
    }
  })

  it('platformOwner can read all donations', () => {
    expect(callAccess('read', { role: 'platformOwner' })).toBe(true)
  })

  it('tenant admin reads are scoped to their tenant', () => {
    expect(callAccess('read', { role: 'admin', tenant: 9 })).toEqual({
      tenant: { equals: 9 },
    })
  })

  it('cross-tenant read isolation: tenant A cannot read tenant B donations', () => {
    const where = callAccess('read', { role: 'admin', tenant: 1 }) as {
      tenant: { equals: number }
    }
    expect(where.tenant.equals).toBe(1)
    expect(where.tenant.equals).not.toBe(2)
  })

  it('unauthenticated users are denied reads', () => {
    expect(callAccess('read', undefined)).toBe(false)
  })

  it('user without a tenant is denied reads', () => {
    expect(callAccess('read', { role: 'admin' })).toBe(false)
  })
})

describe('Donations schema', () => {
  it('marks stripePaymentIntentId unique to dedupe webhook events', () => {
    const f = (Donations.fields as any[]).find((x) => x.name === 'stripePaymentIntentId')
    expect(f?.unique).toBe(true)
  })

  it('frequency enum includes one_time and monthly', () => {
    const f = (Donations.fields as any[]).find((x) => x.name === 'frequency')
    const values = (f.options as Array<{ value: string }>).map((o) => o.value)
    expect(values).toEqual(expect.arrayContaining(['one_time', 'monthly']))
  })

  it('status enum includes succeeded, refunded, failed', () => {
    const f = (Donations.fields as any[]).find((x) => x.name === 'status')
    const values = (f.options as Array<{ value: string }>).map((o) => o.value)
    expect(values).toEqual(expect.arrayContaining(['succeeded', 'refunded', 'failed']))
  })
})
