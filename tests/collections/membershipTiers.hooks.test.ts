// tests/collections/membershipTiers.hooks.test.ts
import { describe, it, expect, vi } from 'vitest'
import { syncTierAfterChange } from '@/collections/MembershipTiers.hooks'

const stripeMock = {
  products: { create: vi.fn(async () => ({ id: 'prod_new' })), update: vi.fn(async () => ({})) },
  prices: { create: vi.fn(async () => ({ id: 'price_new' })), update: vi.fn(async () => ({})) },
}

vi.mock('@/lib/stripe-connect', () => ({
  stripeForAccount: () => stripeMock,
}))

const tenantWithConnect = { id: 7, stripeAccountId: 'acct_x', stripeChargesEnabled: true }

function makeReq() {
  const updates: any[] = []
  return {
    payload: {
      findByID: vi.fn(async ({ id }) => (id === 7 ? tenantWithConnect : null)),
      update: vi.fn(async (args) => { updates.push(args); return args.data }),
    },
    _updates: updates,
  } as any
}

describe('syncTierAfterChange', () => {
  it('on create, sets stripeProductId and stripePriceId', async () => {
    stripeMock.products.create.mockClear(); stripeMock.prices.create.mockClear()
    const req = makeReq()
    const doc = { id: 1, tenant: 7, name: 'Supporting', amountCents: 2500, cadence: 'monthly', active: true, stripeProductId: null, stripePriceId: null, archivedPriceIds: [] }
    await syncTierAfterChange({ doc, previousDoc: null, operation: 'create', req } as any)
    expect(req._updates[0].data.stripeProductId).toBe('prod_new')
    expect(req._updates[0].data.stripePriceId).toBe('price_new')
  })

  it('on amountCents change, archives old price and creates new', async () => {
    stripeMock.products.create.mockClear(); stripeMock.prices.create.mockClear(); stripeMock.prices.update.mockClear()
    const req = makeReq()
    const doc = { id: 1, tenant: 7, name: 'S', amountCents: 5000, cadence: 'monthly', active: true, stripeProductId: 'prod_x', stripePriceId: 'price_old', archivedPriceIds: [] }
    const previousDoc = { ...doc, amountCents: 2500 }
    await syncTierAfterChange({ doc, previousDoc, operation: 'update', req } as any)
    expect(stripeMock.prices.update).toHaveBeenCalledWith('price_old', expect.objectContaining({ active: false }), expect.any(Object))
    expect(stripeMock.prices.create).toHaveBeenCalled()
    expect(req._updates[0].data.archivedPriceIds[0].priceId).toBe('price_old')
  })

  it('on active→false, archives in Stripe but leaves IDs on the row', async () => {
    stripeMock.prices.update.mockClear(); stripeMock.products.update.mockClear()
    const req = makeReq()
    const doc = { id: 1, tenant: 7, name: 'S', amountCents: 2500, cadence: 'monthly', active: false, stripeProductId: 'prod_x', stripePriceId: 'price_x', archivedPriceIds: [] }
    const previousDoc = { ...doc, active: true }
    await syncTierAfterChange({ doc, previousDoc, operation: 'update', req } as any)
    expect(stripeMock.prices.update).toHaveBeenCalledWith('price_x', expect.objectContaining({ active: false }), expect.any(Object))
    expect(stripeMock.products.update).toHaveBeenCalledWith('prod_x', expect.objectContaining({ active: false }), expect.any(Object))
  })

  it('on tenant without Stripe Connect, stores error on row but does not throw', async () => {
    const req = {
      payload: {
        findByID: vi.fn(async () => ({ id: 7, stripeAccountId: null, stripeChargesEnabled: false })),
        update: vi.fn(),
      },
    } as any
    const doc = { id: 1, tenant: 7, name: 'S', amountCents: 2500, cadence: 'monthly', active: true, stripeProductId: null, stripePriceId: null, archivedPriceIds: [] }
    await syncTierAfterChange({ doc, previousDoc: null, operation: 'create', req } as any)
    expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastStripeSyncError: expect.stringContaining('Stripe Connect not enabled'),
      }),
    }))
  })
})
