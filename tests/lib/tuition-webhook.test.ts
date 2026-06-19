// tests/lib/tuition-webhook.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleTuitionEvent } from '@/lib/tuition-webhook'

/**
 * Collection-aware mock. By default tenant 1 owns connected account acct_x, and
 * form-submission 9 holds a self-model registration for one participant — the
 * legitimate happy path. Overrides let each test simulate forged/cross-tenant
 * events, duplicates, etc.
 */
function makePayload(
  over: {
    tenantId?: number | null // tenant resolved from the connected account
    existingSubs?: any[] // program-subscriptions matched by stripeSubscriptionId
    submission?: any // the form-submission returned by findByID
    form?: any // the form returned by findByID('forms')
    classes?: any[] // active school-classes for the program
  } = {},
) {
  const tenantDocs = over.tenantId === null ? [] : [{ id: over.tenantId ?? 1 }]
  const existingSubs = over.existingSubs ?? []
  const submission = over.submission ?? {
    id: 9,
    form: 7,
    tenant: 1,
    data: { student_first_name: 'Aisha', student_last_name: 'Khan', guardian_email: 'g@x.com' },
  }
  const form = over.form ?? {
    id: 7,
    schoolRegistration: true,
    registration: { participantModel: 'self' },
    registrationProgram: 7,
    payment: { paymentModel: 'monthly' },
  }
  const classes = over.classes ?? [{ id: 50 }] // single active class → auto-enroll

  const find = vi.fn(async ({ collection }: any) => {
    if (collection === 'tenants') return { docs: tenantDocs }
    if (collection === 'program-subscriptions') return { docs: existingSubs }
    if (collection === 'school-classes') return { docs: classes }
    return { docs: [] }
  })
  const findByID = vi.fn(async ({ collection, id }: any) => {
    if (collection === 'form-submissions' && String(id) === '9') return submission
    if (collection === 'forms') return form
    return null
  })
  const create = vi.fn(async (a: any) => ({ id: a.collection === 'program-subscriptions' ? 200 : 300, ...a.data }))
  const update = vi.fn(async (a: any) => a.data)
  const logger = { error: vi.fn(), warn: vi.fn() }
  return { find, findByID, create, update, logger } as any
}

const baseSession = {
  id: 'cs_1',
  customer: 'cus_1',
  customer_email: 'g@x.com',
  customer_details: { email: 'g@x.com', name: 'Guardian' },
  subscription: 'sub_1',
  metadata: { kind: 'tuition', tenantId: '1', submissionId: '9', programId: '7' },
}

const subFetch = () =>
  vi.fn(async () => ({ id: 'sub_1', status: 'active', current_period_end: 1735689600 }))

const checkoutEvent = (over: Partial<typeof baseSession> = {}, account: string | undefined = 'acct_x') =>
  ({
    type: 'checkout.session.completed',
    data: { object: { ...baseSession, ...over } },
    account,
  }) as any

describe('handleTuitionEvent', () => {
  it('ignores non-tuition events (metadata.kind !== tuition)', async () => {
    const payload = makePayload()
    await handleTuitionEvent(
      checkoutEvent({ metadata: { kind: 'membership', tenantId: '1' } as any }),
      payload,
      subFetch(),
    )
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('ignores unrelated event types', async () => {
    const payload = makePayload()
    await handleTuitionEvent(
      { type: 'payment_intent.succeeded', data: { object: {} }, account: 'acct_x' } as any,
      payload,
      subFetch(),
    )
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('ignores events without a connected account', async () => {
    const payload = makePayload()
    await handleTuitionEvent(
      { type: 'checkout.session.completed', data: { object: baseSession } } as any,
      payload,
      subFetch(),
    )
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('rejects when no tenant owns the connected account (no writes)', async () => {
    const payload = makePayload({ tenantId: null })
    await handleTuitionEvent(checkoutEvent({}, 'acct_attacker'), payload, subFetch())
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('rejects when event.account maps to a different tenant than metadata.tenantId (no writes)', async () => {
    // account owned by tenant 1, but metadata claims tenant 8
    const payload = makePayload({ tenantId: 1 })
    const forged = checkoutEvent({
      metadata: { kind: 'tuition', tenantId: '8', submissionId: '9', programId: '7' } as any,
    })
    await handleTuitionEvent(forged, payload, subFetch())
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('creates a program-subscription and materializes students on checkout.session.completed', async () => {
    const payload = makePayload()
    await handleTuitionEvent(checkoutEvent(), payload, subFetch())

    // program-subscription created with bound tenant + stripe ids + guardian email
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'program-subscriptions',
        data: expect.objectContaining({
          tenant: 1,
          guardianEmail: 'g@x.com',
          program: 7,
          status: 'active',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
        }),
        overrideAccess: true,
      }),
    )
    // student materialized and linked to the created subscription (id 200)
    const studentCreate = payload.create.mock.calls.find((c: any[]) => c[0]?.collection === 'students')
    expect(studentCreate).toBeTruthy()
    expect(studentCreate[0].data).toEqual(expect.objectContaining({ programSubscription: 200 }))
  })

  it('is idempotent on duplicate events (existing subscription id → update only, no new students)', async () => {
    const payload = makePayload({
      existingSubs: [{ id: 200, stripeSubscriptionId: 'sub_1', tenant: 1 }],
    })
    await handleTuitionEvent(checkoutEvent(), payload, subFetch())

    // No new program-subscription, no students created
    const subCreate = payload.create.mock.calls.find((c: any[]) => c[0]?.collection === 'program-subscriptions')
    const studentCreate = payload.create.mock.calls.find((c: any[]) => c[0]?.collection === 'students')
    expect(subCreate).toBeUndefined()
    expect(studentCreate).toBeUndefined()
    // Status updated on the existing row
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'program-subscriptions', id: 200 }),
    )
  })

  it('customer.subscription.updated updates status/currentPeriodEnd, no student changes', async () => {
    const payload = makePayload({ existingSubs: [{ id: 200, stripeSubscriptionId: 'sub_1', tenant: 1 }] })
    await handleTuitionEvent(
      {
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_1', status: 'past_due', current_period_end: 1735689600 } },
        account: 'acct_x',
      } as any,
      payload,
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'program-subscriptions',
        id: 200,
        data: expect.objectContaining({ status: 'past_due', stripeSubscriptionStatus: 'past_due' }),
      }),
    )
    const studentCreate = payload.create.mock.calls.find((c: any[]) => c[0]?.collection === 'students')
    expect(studentCreate).toBeUndefined()
  })

  it('customer.subscription.updated drops when the row tenant does not own the account', async () => {
    const payload = makePayload({ existingSubs: [{ id: 200, stripeSubscriptionId: 'sub_1', tenant: 2 }], tenantId: 1 })
    await handleTuitionEvent(
      {
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_1', status: 'past_due', current_period_end: 1735689600 } },
        account: 'acct_x',
      } as any,
      payload,
    )
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('customer.subscription.updated: no-op when subscription row not found', async () => {
    const payload = makePayload({ existingSubs: [] })
    await handleTuitionEvent(
      {
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_unknown', status: 'active', current_period_end: 1735689600 } },
        account: 'acct_x',
      } as any,
      payload,
    )
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('customer.subscription.deleted sets canceled + canceledAt', async () => {
    const payload = makePayload({ existingSubs: [{ id: 200, stripeSubscriptionId: 'sub_1', tenant: 1 }] })
    await handleTuitionEvent(
      {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', status: 'canceled' } },
        account: 'acct_x',
      } as any,
      payload,
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'program-subscriptions',
        id: 200,
        data: expect.objectContaining({
          status: 'canceled',
          stripeSubscriptionStatus: 'canceled',
          canceledAt: expect.any(String),
        }),
      }),
    )
  })
})
