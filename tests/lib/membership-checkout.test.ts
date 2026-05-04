import { describe, it, expect } from 'vitest'
import { buildCheckoutSessionArgs } from '@/lib/membership-checkout'

const tier = { id: 11, name: 'Supporting', stripePriceId: 'price_x', active: true }
const tenant = { id: 7, name: 'Test Masjid', slug: 'test', stripeAccountId: 'acct_x', stripeChargesEnabled: true }

describe('buildCheckoutSessionArgs', () => {
  it('builds subscription-mode session with metadata', () => {
    const args = buildCheckoutSessionArgs(tier, tenant, 'https://test.openmasjid.app')
    expect(args.mode).toBe('subscription')
    expect(args.line_items![0]).toMatchObject({ price: 'price_x', quantity: 1 })
    expect(args.metadata).toMatchObject({ kind: 'membership', tenantId: '7', tierId: '11' })
    expect(args.subscription_data!.metadata).toMatchObject({ kind: 'membership' })
    expect(args.success_url).toContain('/membership/thanks')
    expect(args.cancel_url).toContain('/membership')
  })

  it('includes customer_creation: always', () => {
    const args = buildCheckoutSessionArgs(tier, tenant, 'https://test.openmasjid.app')
    expect(args.customer_creation).toBe('always')
  })

  it('metadata includes tenantId and tierId as strings', () => {
    const args = buildCheckoutSessionArgs(tier, tenant, 'https://test.openmasjid.app')
    expect(args.metadata!.tenantId).toBe('7')
    expect(args.metadata!.tierId).toBe('11')
    expect(args.subscription_data!.metadata!.tenantId).toBe('7')
    expect(args.subscription_data!.metadata!.tierId).toBe('11')
  })

  it('throws if tier has no stripePriceId', () => {
    expect(() =>
      buildCheckoutSessionArgs({ ...tier, stripePriceId: null } as any, tenant, 'https://x'),
    ).toThrow(/not synced/)
  })

  it('throws if tier is not active', () => {
    expect(() =>
      buildCheckoutSessionArgs({ ...tier, active: false }, tenant, 'https://x'),
    ).toThrow(/not active/)
  })

  it('throws if tenant has no Connect (stripeChargesEnabled false)', () => {
    expect(() =>
      buildCheckoutSessionArgs(tier, { ...tenant, stripeChargesEnabled: false } as any, 'https://x'),
    ).toThrow(/Connect/)
  })

  it('throws if tenant has no Connect (stripeChargesEnabled missing)', () => {
    const { stripeChargesEnabled: _, ...tenantNoFlag } = tenant
    expect(() =>
      buildCheckoutSessionArgs(tier, tenantNoFlag as any, 'https://x'),
    ).toThrow(/Connect/)
  })

  it('works with nested donationConfig shape for stripeChargesEnabled', () => {
    const nestedTenant = {
      id: 7,
      name: 'Test Masjid',
      slug: 'test',
      donationConfig: { stripeAccountId: 'acct_x', stripeChargesEnabled: true },
    }
    const args = buildCheckoutSessionArgs(tier, nestedTenant as any, 'https://test.openmasjid.app')
    expect(args.mode).toBe('subscription')
  })

  it('success_url includes {CHECKOUT_SESSION_ID} placeholder', () => {
    const args = buildCheckoutSessionArgs(tier, tenant, 'https://test.openmasjid.app')
    expect(args.success_url).toContain('{CHECKOUT_SESSION_ID}')
  })
})
