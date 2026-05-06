// tests/lib/form-submit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitForm } from '@/lib/form-submit'
import { _resetForTest } from '@/lib/form-rate-limit'
import type { FormSchema } from '@/lib/form-schema'

const minimalSchema: FormSchema = {
  steps: [{ id: 's1', fields: [
    { type: 'email', id: 'f1', name: 'email', label: 'Email', required: true },
    { type: 'short-text', id: 'f2', name: 'name', label: 'Name', required: true },
  ]}],
}

const publishedForm = {
  id: 'form-1',
  tenant: { id: 'tenant-1' },
  title: 'Test Form',
  status: 'published',
  schema: minimalSchema,
  settings: {},
  payment: undefined,
}

function makeMockPayload(overrides?: { countDocs?: number }) {
  return {
    create: vi.fn().mockResolvedValue({ id: 'sub-123' }),
    count: vi.fn().mockResolvedValue({ totalDocs: overrides?.countDocs ?? 0 }),
  } as any
}

describe('submitForm', () => {
  beforeEach(() => _resetForTest())

  it('returns not_published when form status is not published', async () => {
    const payload = makeMockPayload()
    const form = { ...publishedForm, status: 'draft' }
    const result = await submitForm({
      payload,
      form,
      data: { email: 'test@example.com', name: 'Test User' },
      ip: '1.2.3.4',
      userAgent: 'test-agent',
    })
    expect(result).toEqual({ ok: false, error: 'not_published' })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('silently succeeds (honeypot) when _hp field is set', async () => {
    const payload = makeMockPayload()
    const result = await submitForm({
      payload,
      form: publishedForm,
      data: { _hp: 'bot-value', email: 'test@example.com', name: 'Test User' },
      ip: '1.2.3.4',
      userAgent: 'bot-agent',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.checkoutPending).toBe(false)
    }
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('returns rate_limited after exceeding rate limit', async () => {
    const payload = makeMockPayload()
    const validData = { email: 'test@example.com', name: 'Test User' }
    const args = {
      payload,
      form: publishedForm,
      data: validData,
      ip: '1.2.3.4',
      userAgent: 'test-agent',
    }

    // Exhaust the rate limit (5 allowed)
    for (let i = 0; i < 5; i++) {
      const r = await submitForm(args)
      expect(r.ok).toBe(true)
    }

    // 6th should be rate limited
    const result = await submitForm(args)
    expect(result).toEqual({ ok: false, error: 'rate_limited' })
  })

  it('returns validation errors when data does not match schema', async () => {
    const payload = makeMockPayload()
    const result = await submitForm({
      payload,
      form: publishedForm,
      data: { email: 'not-an-email', name: 'Test User' },
      ip: '1.2.3.4',
      userAgent: 'test-agent',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('validation')
      expect(result.errors).toBeDefined()
      expect(result.errors?.email).toBeTruthy()
    }
  })

  it('returns validation errors when required fields are missing', async () => {
    const payload = makeMockPayload()
    const result = await submitForm({
      payload,
      form: publishedForm,
      data: {},
      ip: '1.2.3.4',
      userAgent: 'test-agent',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('validation')
      expect(result.errors?.email).toBe('Required')
      expect(result.errors?.name).toBe('Required')
    }
  })

  it('returns closed when capacity is reached', async () => {
    const payload = makeMockPayload({ countDocs: 10 })
    const form = {
      ...publishedForm,
      settings: { capacity: 10 },
    }
    const result = await submitForm({
      payload,
      form,
      data: { email: 'test@example.com', name: 'Test User' },
      ip: '1.2.3.4',
      userAgent: 'test-agent',
    })
    expect(result).toEqual({ ok: false, error: 'closed' })
    expect(payload.count).toHaveBeenCalledWith({
      collection: 'form-submissions',
      where: {
        and: [
          { form: { equals: 'form-1' } },
          { paymentStatus: { not_in: ['expired'] } },
        ],
      },
    })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('allows submission when count is below capacity', async () => {
    const payload = makeMockPayload({ countDocs: 5 })
    const form = {
      ...publishedForm,
      settings: { capacity: 10 },
    }
    const result = await submitForm({
      payload,
      form,
      data: { email: 'test@example.com', name: 'Test User' },
      ip: '1.2.3.4',
      userAgent: 'test-agent',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.submissionId).toBe('sub-123')
    }
  })

  it('creates a submission on happy path (no payment)', async () => {
    const payload = makeMockPayload()
    const result = await submitForm({
      payload,
      form: publishedForm,
      data: { email: 'user@example.com', name: 'Happy User' },
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.submissionId).toBe('sub-123')
      expect(result.checkoutPending).toBe(false)
    }
    expect(payload.create).toHaveBeenCalledOnce()
    const createArgs = payload.create.mock.calls[0][0]
    expect(createArgs.collection).toBe('form-submissions')
    expect(createArgs.data.submitterEmail).toBe('user@example.com')
    expect(createArgs.data.submitterName).toBe('Happy User')
    expect(createArgs.data.status).toBe('new')
    expect(createArgs.data.paymentStatus).toBe('na')
    expect(createArgs.overrideAccess).toBe(true)
  })

  it('sets checkoutPending and paymentStatus when payment is enabled', async () => {
    const payload = makeMockPayload()
    const form = {
      ...publishedForm,
      payment: { enabled: true },
    }
    const result = await submitForm({
      payload,
      form,
      data: { email: 'user@example.com', name: 'Paying User' },
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.checkoutPending).toBe(true)
    }
    const createArgs = payload.create.mock.calls[0][0]
    expect(createArgs.data.paymentStatus).toBe('pending_payment')
  })

  it('resolves tenant id correctly when tenant is an object', async () => {
    const payload = makeMockPayload()
    await submitForm({
      payload,
      form: { ...publishedForm, tenant: { id: 'tenant-obj-id' } },
      data: { email: 'user@example.com', name: 'Test User' },
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    })
    const createArgs = payload.create.mock.calls[0][0]
    expect(createArgs.data.tenant).toBe('tenant-obj-id')
  })

  it('resolves tenant id correctly when tenant is a string', async () => {
    const payload = makeMockPayload()
    await submitForm({
      payload,
      form: { ...publishedForm, tenant: 'tenant-string-id' },
      data: { email: 'user@example.com', name: 'Test User' },
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    })
    const createArgs = payload.create.mock.calls[0][0]
    expect(createArgs.data.tenant).toBe('tenant-string-id')
  })

  it('skips capacity check when no capacity is set', async () => {
    const payload = makeMockPayload()
    const form = { ...publishedForm, settings: {} }
    await submitForm({
      payload,
      form,
      data: { email: 'user@example.com', name: 'Test User' },
      ip: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    })
    expect(payload.count).not.toHaveBeenCalled()
  })
})
