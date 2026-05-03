import { describe, it, expect, vi } from 'vitest'
import { seedDefaultDonationFunds } from '@/hooks/seedDefaultDonationFunds'

function makeReq() {
  const create = vi.fn().mockResolvedValue({})
  return {
    create,
    req: { payload: { create } } as any,
  }
}

describe('seedDefaultDonationFunds', () => {
  it('creates Sadaqah and Zakat funds on tenant create', async () => {
    const { create, req } = makeReq()
    const doc = { id: 'tenant-1' }
    const result = await seedDefaultDonationFunds({
      doc,
      operation: 'create',
      req,
      collection: { slug: 'tenants' } as any,
      previousDoc: null as any,
      context: {} as any,
    } as any)

    expect(result).toBe(doc)
    expect(create).toHaveBeenCalledTimes(2)

    const calls = create.mock.calls.map((c) => c[0])
    const sadaqah = calls.find((c) => c.data.slug === 'sadaqah')
    const zakat = calls.find((c) => c.data.slug === 'zakat')

    expect(sadaqah).toMatchObject({
      collection: 'donation-funds',
      overrideAccess: true,
      data: {
        tenant: 'tenant-1',
        name: 'Sadaqah',
        slug: 'sadaqah',
        zakatEligible: false,
        active: true,
        sortOrder: 0,
      },
    })
    expect(sadaqah.data.suggestedAmounts).toEqual([
      { amount: 25 },
      { amount: 50 },
      { amount: 100 },
      { amount: 250 },
    ])

    expect(zakat).toMatchObject({
      collection: 'donation-funds',
      overrideAccess: true,
      data: {
        tenant: 'tenant-1',
        name: 'Zakat',
        slug: 'zakat',
        zakatEligible: true,
        active: true,
        sortOrder: 1,
      },
    })
    expect(zakat.data.suggestedAmounts).toEqual([
      { amount: 100 },
      { amount: 250 },
      { amount: 500 },
    ])
  })

  it('does nothing on update', async () => {
    const { create, req } = makeReq()
    const doc = { id: 'tenant-1' }
    const result = await seedDefaultDonationFunds({
      doc,
      operation: 'update',
      req,
      collection: { slug: 'tenants' } as any,
      previousDoc: { id: 'tenant-1' } as any,
      context: {} as any,
    } as any)
    expect(result).toBe(doc)
    expect(create).not.toHaveBeenCalled()
  })
})
