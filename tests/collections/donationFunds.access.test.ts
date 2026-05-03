import { describe, it, expect } from 'vitest'
import { DonationFunds } from '@/collections/DonationFunds'

/**
 * Unit-style tests for the DonationFunds collection access policy.
 *
 * Mirrors the pattern in tests/access/billingLocked.test.ts: invoke the
 * access function directly with a mock req. Avoids spinning up a full
 * Payload instance, matching the existing test conventions in this repo.
 */

function callAccess(op: 'read' | 'create' | 'update' | 'delete', user: any) {
  const access = DonationFunds.access as Record<string, any>
  const fn = access[op]
  return fn({ req: { user } })
}

describe('DonationFunds access', () => {
  it('denies all operations when user is missing', () => {
    expect(callAccess('read', undefined)).toBe(false)
    expect(callAccess('create', undefined)).toBe(false)
    expect(callAccess('update', undefined)).toBe(false)
    expect(callAccess('delete', undefined)).toBe(false)
  })

  it('platformOwner has full access regardless of tenant', () => {
    const user = { role: 'platformOwner' }
    expect(callAccess('read', user)).toBe(true)
    expect(callAccess('create', user)).toBe(true)
    expect(callAccess('update', user)).toBe(true)
    expect(callAccess('delete', user)).toBe(true)
  })

  it('tenant user reads scoped to their tenant', () => {
    const user = { role: 'admin', tenant: 7 }
    expect(callAccess('read', user)).toEqual({ tenant: { equals: 7 } })
    expect(callAccess('update', user)).toEqual({ tenant: { equals: 7 } })
    expect(callAccess('delete', user)).toEqual({ tenant: { equals: 7 } })
  })

  it('cross-tenant query never matches another tenant', () => {
    const userA = { role: 'admin', tenant: 1 }
    const where = callAccess('read', userA) as { tenant: { equals: number } }
    // The where filter restricts results to tenant 1, so a fund created
    // for tenant 2 (id 2) cannot be returned by this query.
    expect(where.tenant.equals).toBe(1)
    expect(where.tenant.equals).not.toBe(2)
  })

  it('user without a tenant gets denied', () => {
    const user = { role: 'admin' }
    expect(callAccess('read', user)).toBe(false)
    expect(callAccess('create', user)).toBe(false)
  })

  it('tenant id resolves correctly when user.tenant is an object', () => {
    const user = { role: 'admin', tenant: { id: 42 } }
    expect(callAccess('read', user)).toEqual({ tenant: { equals: 42 } })
  })
})

describe('DonationFunds schema', () => {
  it('declares a unique composite index on [tenant, slug]', () => {
    const idx = DonationFunds.indexes ?? []
    const composite = idx.find(
      (i) =>
        Array.isArray(i.fields) &&
        i.fields.length === 2 &&
        i.fields[0] === 'tenant' &&
        i.fields[1] === 'slug',
    )
    expect(composite).toBeDefined()
    expect(composite?.unique).toBe(true)
  })

  it('uses slug as a non-unique field on its own (uniqueness is composite)', () => {
    const slugField = (DonationFunds.fields as any[]).find((f) => f.name === 'slug')
    expect(slugField).toBeDefined()
    expect(slugField.unique).toBeUndefined()
  })
})
