// tests/lib/form-submissions-webhook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleFormSubmissionEvent } from '@/lib/form-submissions-webhook'

vi.mock('@/lib/form-notifications', () => ({
  sendFormNotifications: vi.fn(),
}))

import { sendFormNotifications } from '@/lib/form-notifications'

function makePayload({
  submissionStatus = 'pending_payment',
}: { submissionStatus?: string } = {}) {
  const findByID = vi.fn(async ({ collection, id }: any) => {
    if (collection === 'form-submissions') {
      return {
        id,
        paymentStatus: submissionStatus,
        form: 'form_abc',
        amountCents: 1000,
        currency: 'usd',
        submittedAt: '2024-01-01T00:00:00.000Z',
        submitterEmail: 'user@example.com',
        data: {},
      }
    }
    if (collection === 'forms') {
      return { id, title: 'Test Form', settings: {} }
    }
    return {}
  })
  const update = vi.fn(async (a: any) => a.data)
  return { findByID, update } as any
}

const baseCompletedEvent = {
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_1',
      payment_intent: 'pi_abc123',
      amount_total: 2000,
      currency: 'usd',
      metadata: {
        kind: 'form-submission',
        submissionId: 'sub_1',
        formId: 'form_abc',
        tenantId: '1',
      },
    },
  },
}

const baseExpiredEvent = {
  type: 'checkout.session.expired',
  data: {
    object: {
      id: 'cs_2',
      metadata: {
        kind: 'form-submission',
        submissionId: 'sub_1',
        formId: 'form_abc',
        tenantId: '1',
      },
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleFormSubmissionEvent', () => {
  it('checkout.session.completed flips submission to paid, sets paidAt, records stripePaymentIntentId, calls sendFormNotifications', async () => {
    const payload = makePayload()
    await handleFormSubmissionEvent({ event: baseCompletedEvent as any, payload })

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'form-submissions',
        id: 'sub_1',
        data: expect.objectContaining({
          paymentStatus: 'paid',
          paidAt: expect.any(String),
          stripePaymentIntentId: 'pi_abc123',
          amountCents: 2000,
          currency: 'usd',
        }),
        overrideAccess: true,
      }),
    )
    expect(sendFormNotifications).toHaveBeenCalledOnce()
  })

  it('ignores events with other kind values (donation)', async () => {
    const payload = makePayload()
    const event = {
      ...baseCompletedEvent,
      data: {
        object: {
          ...baseCompletedEvent.data.object,
          metadata: { kind: 'donation', submissionId: 'sub_1' },
        },
      },
    }
    await handleFormSubmissionEvent({ event: event as any, payload })
    expect(payload.update).not.toHaveBeenCalled()
    expect(sendFormNotifications).not.toHaveBeenCalled()
  })

  it('ignores events with missing kind', async () => {
    const payload = makePayload()
    const event = {
      ...baseCompletedEvent,
      data: {
        object: {
          ...baseCompletedEvent.data.object,
          metadata: {},
        },
      },
    }
    await handleFormSubmissionEvent({ event: event as any, payload })
    expect(payload.update).not.toHaveBeenCalled()
    expect(sendFormNotifications).not.toHaveBeenCalled()
  })

  it('ignores non-checkout event types (payment_intent.succeeded)', async () => {
    const payload = makePayload()
    const event = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          metadata: { kind: 'form-submission', submissionId: 'sub_1' },
        },
      },
    }
    await handleFormSubmissionEvent({ event: event as any, payload })
    expect(payload.update).not.toHaveBeenCalled()
    expect(sendFormNotifications).not.toHaveBeenCalled()
  })

  it('checkout.session.expired flips submission to expired', async () => {
    const payload = makePayload()
    await handleFormSubmissionEvent({ event: baseExpiredEvent as any, payload })

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'form-submissions',
        id: 'sub_1',
        data: { paymentStatus: 'expired' },
        overrideAccess: true,
      }),
    )
    expect(sendFormNotifications).not.toHaveBeenCalled()
  })

  it('is idempotent: if submission is already paid, does not update again or send double notification', async () => {
    const payload = makePayload({ submissionStatus: 'paid' })
    await handleFormSubmissionEvent({ event: baseCompletedEvent as any, payload })

    expect(payload.update).not.toHaveBeenCalled()
    expect(sendFormNotifications).not.toHaveBeenCalled()
  })
})
