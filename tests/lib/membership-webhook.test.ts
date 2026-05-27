// tests/lib/membership-webhook.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleMembershipEvent } from '@/lib/membership-webhook'

/**
 * Collection-aware mock. By default tenant 7 owns connected account acct_x and
 * tier 11 belongs to tenant 7 — the legitimate happy path. Overrides let each
 * test simulate forged/cross-tenant events.
 */
function makePayload(
  over: {
    members?: any[]
    tenantId?: number | null // tenant resolved from the connected account
    tier?: any // tier returned for the checkout binding's id lookup
    tierByPrice?: any // tier returned for the subscription.updated price lookup
  } = {},
) {
  const members = over.members ?? []
  const tenantDocs = over.tenantId === null ? [] : [{ id: over.tenantId ?? 7 }]
  const tier = over.tier === undefined ? { id: 11, tenant: 7 } : over.tier
  const find = vi.fn(async ({ collection, where }: any) => {
    if (collection === 'tenants') return { docs: tenantDocs }
    if (collection === 'membership-tiers') {
      if (where?.id) return { docs: tier ? [tier] : [] }
      return { docs: over.tierByPrice ? [over.tierByPrice] : [] }
    }
    if (collection === 'members') return { docs: members }
    return { docs: [] }
  })
  const create = vi.fn(async (a: any) => ({ id: 99, ...a.data }))
  const update = vi.fn(async (a: any) => a.data)
  return { find, create, update } as any
}

const baseSession = {
  id: 'cs_1',
  customer: 'cus_1',
  customer_email: 'a@b.com',
  customer_details: { name: 'Test User', phone: '555' },
  subscription: 'sub_1',
  metadata: { kind: 'membership', tenantId: '7', tierId: '11' },
}

const subFetch = () =>
  vi.fn(async () => ({ id: 'sub_1', status: 'active', current_period_end: 1735689600 }))

describe('handleMembershipEvent', () => {
  it('checkout.session.completed creates a Member row', async () => {
    const payload = makePayload()
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: baseSession }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: subFetch(),
    })
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'members',
      data: expect.objectContaining({
        email: 'a@b.com',
        name: 'Test User',
        tenant: 7,
        tier: 11,
        status: 'active',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
      }),
      overrideAccess: true,
    }))
  })

  it('checkout.session.completed updates existing Member (same tenant+email)', async () => {
    const existingMember = { id: 55, email: 'a@b.com', tenant: 7, joinedAt: '2024-01-01T00:00:00.000Z' }
    const payload = makePayload({ members: [existingMember] })
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: baseSession }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: subFetch(),
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'members',
      id: 55,
      data: expect.objectContaining({ joinedAt: '2024-01-01T00:00:00.000Z', email: 'a@b.com' }),
      overrideAccess: true,
    }))
  })

  it('drops checkout when no tenant owns the connected account', async () => {
    const payload = makePayload({ tenantId: null })
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: baseSession }, account: 'acct_attacker' } as any,
      payload,
      stripeSubscriptionRetrieve: subFetch(),
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('drops checkout when metadata tenantId does not match the account owner', async () => {
    const payload = makePayload({ tenantId: 7 }) // account owned by 7
    const forged = { ...baseSession, metadata: { kind: 'membership', tenantId: '8', tierId: '11' } }
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: forged }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: subFetch(),
    })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('drops checkout when the tier belongs to a different tenant', async () => {
    const payload = makePayload({ tier: { id: 11, tenant: 2 } })
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: baseSession }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: subFetch(),
    })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('customer.subscription.updated flips bucket to grace on past_due', async () => {
    const payload = makePayload({ members: [{ id: 99, stripeSubscriptionId: 'sub_1', tenant: 7 }] })
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_1', status: 'past_due', current_period_end: 1735689600 } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'members',
      id: 99,
      data: expect.objectContaining({ status: 'grace', stripeSubscriptionStatus: 'past_due' }),
    }))
  })

  it('customer.subscription.updated updates tier when price ID matches a different tier (portal upgrade)', async () => {
    const payload = makePayload({
      members: [{ id: 99, stripeSubscriptionId: 'sub_1', tier: 11, tenant: 7 }],
      tierByPrice: { id: 22, stripePriceId: 'price_new' },
    })
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            status: 'active',
            current_period_end: 1735689600,
            items: { data: [{ price: { id: 'price_new' } }] },
          },
        },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'members',
      id: 99,
      data: expect.objectContaining({ tier: 22, status: 'active' }),
    }))
  })

  it('customer.subscription.updated drops when member tenant does not own the account', async () => {
    const payload = makePayload({ members: [{ id: 99, stripeSubscriptionId: 'sub_1', tenant: 2 }], tenantId: 7 })
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_1', status: 'past_due', current_period_end: 1735689600 } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('customer.subscription.deleted sets inactive + canceledAt + canceled status', async () => {
    const payload = makePayload({ members: [{ id: 99, stripeSubscriptionId: 'sub_1', tenant: 7 }] })
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', status: 'canceled' } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'inactive',
        canceledAt: expect.any(String),
        stripeSubscriptionStatus: 'canceled',
      }),
    }))
  })

  it('ignores non-membership events (no metadata.kind)', async () => {
    const payload = makePayload()
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: { ...baseSession, metadata: {} } }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: vi.fn(),
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('ignores events without a connected account', async () => {
    const payload = makePayload()
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: baseSession } } as any,
      payload,
      stripeSubscriptionRetrieve: vi.fn(),
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('customer.subscription.updated: no-op when member not found', async () => {
    const payload = makePayload({ members: [] })
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_unknown', status: 'active', current_period_end: 1735689600 } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('customer.subscription.deleted: no-op when member not found', async () => {
    const payload = makePayload({ members: [] })
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_unknown', status: 'canceled' } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('checkout.session.completed: missing subscription id is a no-op', async () => {
    const payload = makePayload()
    await handleMembershipEvent({
      event: {
        type: 'checkout.session.completed',
        data: { object: { ...baseSession, subscription: null } },
        account: 'acct_x',
      } as any,
      payload,
      stripeSubscriptionRetrieve: vi.fn(),
    })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('unhandled event types are a no-op', async () => {
    const payload = makePayload()
    await handleMembershipEvent({
      event: { type: 'payment_intent.succeeded', data: { object: {} }, account: 'acct_x' } as any,
      payload,
    })
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})
