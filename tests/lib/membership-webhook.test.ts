// tests/lib/membership-webhook.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleMembershipEvent } from '@/lib/membership-webhook'

function makePayload() {
  const findStub = vi.fn(async ({ collection, where }: any) => {
    // dispatch by collection + where
    if (collection === 'tenants') return { docs: [{ id: 7, stripeAccountId: where.stripeAccountId.equals }] }
    if (collection === 'membership-tiers') return { docs: [{ id: 11, tenant: 7, stripePriceId: where?.stripePriceId?.equals ?? 'price_x' }] }
    if (collection === 'members') return { docs: [] }
    return { docs: [] }
  })
  const create = vi.fn(async (a: any) => ({ id: 99, ...a.data }))
  const update = vi.fn(async (a: any) => a.data)
  return { find: findStub, create, update } as any
}

const baseSession = {
  id: 'cs_1',
  customer: 'cus_1',
  customer_email: 'a@b.com',
  customer_details: { name: 'Test User', phone: '555' },
  subscription: 'sub_1',
  metadata: { kind: 'membership', tenantId: '7', tierId: '11' },
}

describe('handleMembershipEvent', () => {
  it('checkout.session.completed creates a Member row', async () => {
    const payload = makePayload()
    payload.find = vi.fn(async ({ collection }: any) => {
      if (collection === 'tenants') return { docs: [{ id: 7, stripeAccountId: 'acct_x' }] }
      if (collection === 'membership-tiers') return { docs: [{ id: 11 }] }
      if (collection === 'members') return { docs: [] }
      return { docs: [] }
    })
    const subFetch = vi.fn(async () => ({ id: 'sub_1', status: 'active', current_period_end: 1735689600 }))
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: baseSession }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: subFetch,
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
    const payload = makePayload()
    const existingMember = { id: 55, email: 'a@b.com', tenant: 7, joinedAt: '2024-01-01T00:00:00.000Z' }
    payload.find = vi.fn(async ({ collection }: any) => {
      if (collection === 'membership-tiers') return { docs: [{ id: 11 }] }
      if (collection === 'members') return { docs: [existingMember] }
      return { docs: [] }
    })
    const subFetch = vi.fn(async () => ({ id: 'sub_1', status: 'active', current_period_end: 1735689600 }))
    await handleMembershipEvent({
      event: { type: 'checkout.session.completed', data: { object: baseSession }, account: 'acct_x' } as any,
      payload,
      stripeSubscriptionRetrieve: subFetch,
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'members',
      id: 55,
      data: expect.objectContaining({
        // preserve the original joinedAt
        joinedAt: '2024-01-01T00:00:00.000Z',
        email: 'a@b.com',
      }),
      overrideAccess: true,
    }))
  })

  it('customer.subscription.updated flips bucket to grace on past_due', async () => {
    const payload = makePayload()
    payload.find = vi.fn(async ({ collection }: any) => {
      if (collection === 'members') return { docs: [{ id: 99, stripeSubscriptionId: 'sub_1' }] }
      return { docs: [] }
    })
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
    const payload = makePayload()
    payload.find = vi.fn(async ({ collection, where }: any) => {
      if (collection === 'members') return { docs: [{ id: 99, stripeSubscriptionId: 'sub_1', tier: 11 }] }
      if (collection === 'membership-tiers') {
        // price_new matches tier 22
        return { docs: [{ id: 22, stripePriceId: 'price_new' }] }
      }
      return { docs: [] }
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

  it('customer.subscription.deleted sets inactive + canceledAt', async () => {
    const payload = makePayload()
    payload.find = vi.fn(async () => ({ docs: [{ id: 99, stripeSubscriptionId: 'sub_1' }] }))
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', status: 'canceled' } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'inactive', canceledAt: expect.any(String) }),
    }))
  })

  it('customer.subscription.deleted sets stripeSubscriptionStatus = "canceled"', async () => {
    const payload = makePayload()
    payload.find = vi.fn(async () => ({ docs: [{ id: 99, stripeSubscriptionId: 'sub_1' }] }))
    await handleMembershipEvent({
      event: {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', status: 'canceled' } },
        account: 'acct_x',
      } as any,
      payload,
    })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stripeSubscriptionStatus: 'canceled' }),
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
    const payload = makePayload()
    payload.find = vi.fn(async () => ({ docs: [] }))
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
    const payload = makePayload()
    payload.find = vi.fn(async () => ({ docs: [] }))
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
