import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ---------------------------------------------------------------

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/tenant-server', () => ({
  getTenantContext: vi.fn(),
  resolveTenantFromContext: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find: vi.fn(),
    findByID: vi.fn(),
    update: vi.fn(),
  })),
}))

vi.mock('@/lib/form-submit', () => ({ submitForm: vi.fn() }))
vi.mock('@/lib/form-notifications', () => ({ sendFormNotifications: vi.fn() }))
vi.mock('@/lib/form-checkout', () => ({ createFormCheckoutSession: vi.fn() }))

// ---- Import under test (after mocks) ------------------------------------

import { POST } from '@/app/api/forms/[slug]/submit/route'
import * as tenantServer from '@/lib/tenant-server'
import * as formSubmit from '@/lib/form-submit'
import * as formNotifications from '@/lib/form-notifications'
import * as formCheckout from '@/lib/form-checkout'
import { getPayload } from 'payload'

// ---- Helpers -------------------------------------------------------------

const TENANT = { id: 'tenant-1', slug: 'masjid-test', stripeAccountId: 'acct_test' }
const FORM = {
  id: 'form-1',
  slug: 'registration',
  title: 'Test Registration',
  status: 'published',
  schema: [],
  payment: { enabled: false, currency: 'usd', priceCents: 0 },
  settings: {},
  tenant: 'tenant-1',
}
const SUBMISSION = { id: 'sub-1', data: { name: 'Ali', email: 'ali@example.com' } }

function makeReq(body: unknown = {}, slug = 'registration') {
  return new Request(`http://test/api/forms/${slug}/submit`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '1.1.1.1',
      'user-agent': 'test-agent',
    },
    body: JSON.stringify(body),
  })
}

function makeParams(slug = 'registration'): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) }
}

let payloadInstance: {
  find: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

beforeEach(async () => {
  vi.clearAllMocks()

  payloadInstance = {
    find: vi.fn(),
    findByID: vi.fn(),
    update: vi.fn(),
  }
  vi.mocked(getPayload).mockResolvedValue(payloadInstance as any)

  vi.mocked(tenantServer.getTenantContext).mockResolvedValue({
    type: 'tenant-subdomain',
    slug: 'masjid-test',
  } as any)
  vi.mocked(tenantServer.resolveTenantFromContext).mockResolvedValue(TENANT as any)
  payloadInstance.find.mockResolvedValue({ docs: [FORM] })
  payloadInstance.findByID.mockResolvedValue(SUBMISSION)
  payloadInstance.update.mockResolvedValue(SUBMISSION)
  vi.mocked(formSubmit.submitForm).mockResolvedValue({
    ok: true,
    submissionId: 'sub-1',
    checkoutPending: false,
  })
  vi.mocked(formNotifications.sendFormNotifications).mockResolvedValue(undefined)
  vi.mocked(formCheckout.createFormCheckoutSession).mockResolvedValue({
    id: 'cs_test',
    url: 'https://checkout.stripe.com/x',
  } as any)
})

// ---- Tests ---------------------------------------------------------------

describe('POST /api/forms/[slug]/submit', () => {
  it('returns 404 when tenant not found', async () => {
    vi.mocked(tenantServer.resolveTenantFromContext).mockResolvedValue(null)

    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('tenant_not_found')
  })

  it('returns 404 when form not found (no docs)', async () => {
    payloadInstance.find.mockResolvedValue({ docs: [] })

    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('not_found')
  })

  it('returns 422 on validation error with fieldErrors', async () => {
    vi.mocked(formSubmit.submitForm).mockResolvedValue({
      ok: false,
      error: 'validation',
      errors: { name: 'Required', email: 'Invalid email' },
    })

    const res = await POST(makeReq({ name: '' }), makeParams())
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('validation')
    expect(body.fieldErrors).toEqual({ name: 'Required', email: 'Invalid email' })
  })

  it('returns 429 when rate-limited', async () => {
    vi.mocked(formSubmit.submitForm).mockResolvedValue({ ok: false, error: 'rate_limited' })

    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('rate_limited')
  })

  it('returns 410 when form is closed (capacity reached)', async () => {
    vi.mocked(formSubmit.submitForm).mockResolvedValue({ ok: false, error: 'closed' })

    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toBe('closed')
  })

  it('returns 200 on happy path (no payment), calls sendFormNotifications', async () => {
    vi.mocked(formSubmit.submitForm).mockResolvedValue({
      ok: true,
      submissionId: 'sub-1',
      checkoutPending: false,
    })

    const res = await POST(makeReq({ name: 'Ali', email: 'ali@test.com' }), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })

    expect(formNotifications.sendFormNotifications).toHaveBeenCalledOnce()
    expect(formNotifications.sendFormNotifications).toHaveBeenCalledWith({
      form: FORM,
      submission: SUBMISSION,
    })
    expect(formCheckout.createFormCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns 200 with checkoutUrl when payment.enabled, calls createFormCheckoutSession', async () => {
    const formWithPayment = {
      ...FORM,
      payment: { enabled: true, currency: 'usd', priceCents: 5000 },
    }
    payloadInstance.find.mockResolvedValue({ docs: [formWithPayment] })
    vi.mocked(formSubmit.submitForm).mockResolvedValue({
      ok: true,
      submissionId: 'sub-1',
      checkoutPending: true,
    })

    const res = await POST(makeReq({ name: 'Ali', email: 'ali@test.com' }), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, checkoutUrl: 'https://checkout.stripe.com/x' })

    expect(formCheckout.createFormCheckoutSession).toHaveBeenCalledOnce()
    expect(formCheckout.createFormCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: TENANT,
        form: formWithPayment,
        submission: SUBMISSION,
        amountCents: 5000,
      }),
    )
    expect(payloadInstance.update).toHaveBeenCalledOnce()
    expect(formNotifications.sendFormNotifications).not.toHaveBeenCalled()
  })

  it('uses _amount_cents from body when present', async () => {
    const formWithPayment = {
      ...FORM,
      payment: { enabled: true, currency: 'usd', priceCents: 5000 },
    }
    payloadInstance.find.mockResolvedValue({ docs: [formWithPayment] })
    vi.mocked(formSubmit.submitForm).mockResolvedValue({
      ok: true,
      submissionId: 'sub-1',
      checkoutPending: true,
    })

    await POST(makeReq({ name: 'Ali', email: 'ali@test.com', _amount_cents: 2500 }), makeParams())

    expect(formCheckout.createFormCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 2500 }),
    )
  })

  it('returns 400 for other submit errors', async () => {
    vi.mocked(formSubmit.submitForm).mockResolvedValue({ ok: false, error: 'not_published' })

    const res = await POST(makeReq(), makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('not_published')
  })

  it('passes x-forwarded-for ip to submitForm', async () => {
    await POST(
      new Request('http://test/api/forms/registration/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '10.0.0.1, 192.168.1.1',
        },
        body: JSON.stringify({}),
      }),
      makeParams(),
    )

    expect(formSubmit.submitForm).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '10.0.0.1' }),
    )
  })
})
