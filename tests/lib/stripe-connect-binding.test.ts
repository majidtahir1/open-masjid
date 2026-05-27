import { describe, it, expect, vi } from 'vitest'
import { relationshipId, tenantIdForConnectedAccount } from '@/lib/stripe-connect-binding'

describe('relationshipId', () => {
  it('reads a numeric id', () => expect(relationshipId(7)).toBe(7))
  it('reads a numeric string id', () => expect(relationshipId('7')).toBe(7))
  it('reads a populated object id', () => expect(relationshipId({ id: 42 })).toBe(42))
  it('returns null for null/undefined', () => {
    expect(relationshipId(null)).toBeNull()
    expect(relationshipId(undefined)).toBeNull()
  })
  it('returns null for a non-numeric value', () => expect(relationshipId('abc')).toBeNull())
})

describe('tenantIdForConnectedAccount', () => {
  it('returns null when no account is given', async () => {
    const payload = { find: vi.fn() }
    expect(await tenantIdForConnectedAccount(payload as never, null)).toBeNull()
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('looks up the tenant by donationConfig.stripeAccountId', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 5 }] })
    const id = await tenantIdForConnectedAccount({ find } as never, 'acct_123')
    expect(id).toBe(5)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        where: { 'donationConfig.stripeAccountId': { equals: 'acct_123' } },
      }),
    )
  })

  it('returns null when no tenant owns the account', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    expect(await tenantIdForConnectedAccount({ find } as never, 'acct_attacker')).toBeNull()
  })
})
