// tests/lib/membership-stripe.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ensureStripeProductAndPrice, archiveTierInStripe } from '@/lib/membership-stripe'

function makeStripeMock() {
  const createdProducts: any[] = []
  const updatedProducts: any[] = []
  const createdPrices: any[] = []
  const updatedPrices: any[] = []
  const stripe = {
    products: {
      create: vi.fn(async (args, _opts) => { const p = { id: `prod_${createdProducts.length + 1}`, ...args }; createdProducts.push(p); return p }),
      update: vi.fn(async (id, args) => { updatedProducts.push({ id, ...args }); return { id, ...args } }),
    },
    prices: {
      create: vi.fn(async (args, _opts) => { const p = { id: `price_${createdPrices.length + 1}`, ...args }; createdPrices.push(p); return p }),
      update: vi.fn(async (id, args) => { updatedPrices.push({ id, ...args }); return { id, ...args } }),
    },
  } as any
  return { stripe, createdProducts, updatedProducts, createdPrices, updatedPrices }
}

const baseTier = {
  id: 1,
  name: 'Supporting',
  amountCents: 2500,
  cadence: 'monthly' as const,
  stripeProductId: null,
  stripePriceId: null,
  archivedPriceIds: [] as { priceId: string }[],
  tenant: { id: 7, stripeAccountId: 'acct_test' },
}

describe('ensureStripeProductAndPrice', () => {
  it('creates product+price on first call', async () => {
    const { stripe } = makeStripeMock()
    const out = await ensureStripeProductAndPrice(baseTier, stripe, 'acct_test')
    expect(out.stripeProductId).toMatch(/^prod_/)
    expect(out.stripePriceId).toMatch(/^price_/)
    expect(stripe.products.create).toHaveBeenCalledOnce()
    expect(stripe.prices.create).toHaveBeenCalledOnce()
    expect(stripe.prices.create.mock.calls[0][0]).toMatchObject({
      unit_amount: 2500,
      currency: 'usd',
      recurring: { interval: 'month' },
    })
  })

  it('creates a new Price when stripePriceId is cleared (hook signals rotation by passing null)', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_existing', stripePriceId: null, amountCents: 5000 }
    const out = await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.products.create).not.toHaveBeenCalled()
    expect(stripe.prices.create).toHaveBeenCalledOnce()
    expect(stripe.prices.create.mock.calls[0][0]).toMatchObject({ unit_amount: 5000 })
    expect(out.stripePriceId).toMatch(/^price_/)
    // helper does NOT archive — that's the hook's job
    expect(stripe.prices.update).not.toHaveBeenCalled()
  })

  it('does not call prices.create when stripePriceId already set (idempotent no-op)', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_existing', stripePriceId: 'price_existing' }
    await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('updates product name in place when name changes; no price rotation', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_existing', stripePriceId: 'price_existing', name: 'Renamed' }
    await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.products.update).toHaveBeenCalledWith('prod_existing', expect.objectContaining({ name: 'Renamed' }), expect.objectContaining({ stripeAccount: 'acct_test' }))
    expect(stripe.prices.create).not.toHaveBeenCalled()
  })

  it('uses correct recurring.interval for yearly cadence', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, cadence: 'yearly' as const, stripePriceId: null }
    await ensureStripeProductAndPrice(tier, stripe, 'acct_test')
    expect(stripe.prices.create.mock.calls[0][0]).toMatchObject({ recurring: { interval: 'year' } })
  })
})

describe('archiveTierInStripe', () => {
  it('archives the current price and the product', async () => {
    const { stripe } = makeStripeMock()
    const tier = { ...baseTier, stripeProductId: 'prod_x', stripePriceId: 'price_x' }
    await archiveTierInStripe(tier, stripe, 'acct_test')
    expect(stripe.prices.update).toHaveBeenCalledWith('price_x', expect.objectContaining({ active: false }), expect.any(Object))
    expect(stripe.products.update).toHaveBeenCalledWith('prod_x', expect.objectContaining({ active: false }), expect.any(Object))
  })

  it('is a no-op when tier was never synced', async () => {
    const { stripe } = makeStripeMock()
    await archiveTierInStripe(baseTier, stripe, 'acct_test')
    expect(stripe.prices.update).not.toHaveBeenCalled()
    expect(stripe.products.update).not.toHaveBeenCalled()
  })
})
