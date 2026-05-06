import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSessionCreate = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: mockSessionCreate,
      },
    },
  }),
}))

import { createFormCheckoutSession } from '@/lib/form-checkout'

const tenant = {
  id: 42,
  stripeAccountId: 'acct_test123',
  slug: 'testmasjid',
  customDomains: null,
}

const form = {
  id: 99,
  title: 'Zakat Form',
  slug: 'zakat-form',
  payment: { currency: 'usd', description: 'Zakat payment' },
}

const submission = { id: 77 }
const amountCents = 5000

const mockPayload = {} as any

beforeEach(() => {
  mockSessionCreate.mockResolvedValue({ id: 'cs_test_mock', url: 'https://checkout.stripe.com/mock' })
})

describe('createFormCheckoutSession', () => {
  it('metadata includes kind=form-submission with stringified ids', async () => {
    await createFormCheckoutSession({ payload: mockPayload, tenant, form, submission, amountCents })
    const [params] = mockSessionCreate.mock.calls[0]
    expect(params.metadata).toMatchObject({
      kind: 'form-submission',
      submissionId: '77',
      formId: '99',
      tenantId: '42',
    })
  })

  it('creates session with stripeAccount option matching tenant.stripeAccountId', async () => {
    await createFormCheckoutSession({ payload: mockPayload, tenant, form, submission, amountCents })
    const [, options] = mockSessionCreate.mock.calls[0]
    expect(options).toMatchObject({ stripeAccount: 'acct_test123' })
  })

  it('success_url contains /api/forms/<slug>/checkout-success?sid={CHECKOUT_SESSION_ID}', async () => {
    await createFormCheckoutSession({ payload: mockPayload, tenant, form, submission, amountCents })
    const [params] = mockSessionCreate.mock.calls[0]
    expect(params.success_url).toContain(`/api/forms/${form.slug}/checkout-success?sid={CHECKOUT_SESSION_ID}`)
  })

  it('cancel_url contains /forms/<slug>?cancelled=<submissionId>', async () => {
    await createFormCheckoutSession({ payload: mockPayload, tenant, form, submission, amountCents })
    const [params] = mockSessionCreate.mock.calls[0]
    expect(params.cancel_url).toContain(`/forms/${form.slug}?cancelled=${submission.id}`)
  })

  it('uses first customDomain when present', async () => {
    const tenantWithDomain = { ...tenant, customDomains: [{ domain: 'mosque.example.com' }] }
    await createFormCheckoutSession({ payload: mockPayload, tenant: tenantWithDomain, form, submission, amountCents })
    const [params] = mockSessionCreate.mock.calls[0]
    expect(params.success_url).toContain('https://mosque.example.com')
    expect(params.cancel_url).toContain('https://mosque.example.com')
  })

  it('uses slug.openmasjid.app when no customDomain', async () => {
    await createFormCheckoutSession({ payload: mockPayload, tenant, form, submission, amountCents })
    const [params] = mockSessionCreate.mock.calls[0]
    expect(params.success_url).toContain('https://testmasjid.openmasjid.app')
    expect(params.cancel_url).toContain('https://testmasjid.openmasjid.app')
  })

  it('throws when stripeAccountId is missing', async () => {
    const tenantNoAccount = { ...tenant, stripeAccountId: null }
    await expect(
      createFormCheckoutSession({ payload: mockPayload, tenant: tenantNoAccount, form, submission, amountCents }),
    ).rejects.toThrow('Tenant has no connected Stripe account')
  })

  it('throws when stripeAccountId is undefined', async () => {
    const tenantNoAccount = { ...tenant, stripeAccountId: undefined }
    await expect(
      createFormCheckoutSession({ payload: mockPayload, tenant: tenantNoAccount, form, submission, amountCents }),
    ).rejects.toThrow('Tenant has no connected Stripe account')
  })

  it('uses payment mode', async () => {
    await createFormCheckoutSession({ payload: mockPayload, tenant, form, submission, amountCents })
    const [params] = mockSessionCreate.mock.calls[0]
    expect(params.mode).toBe('payment')
  })

  it('line_items include correct amount and currency from form.payment', async () => {
    await createFormCheckoutSession({ payload: mockPayload, tenant, form, submission, amountCents })
    const [params] = mockSessionCreate.mock.calls[0]
    expect(params.line_items[0]).toMatchObject({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: 5000,
        product_data: { name: 'Zakat Form', description: 'Zakat payment' },
      },
    })
  })

  it('falls back to usd currency when form.payment has no currency', async () => {
    const formNoCurrency = { ...form, payment: {} }
    await createFormCheckoutSession({ payload: mockPayload, tenant, form: formNoCurrency, submission, amountCents })
    const [params] = mockSessionCreate.mock.calls[0]
    expect(params.line_items[0].price_data.currency).toBe('usd')
  })
})
