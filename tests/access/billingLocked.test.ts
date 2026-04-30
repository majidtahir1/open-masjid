import { describe, it, expect, vi } from 'vitest'
import { withBillingLock } from '@/access/billingLocked'

function makeReq(opts: {
  role?: string
  tenantId?: number | string
  tenantStatus?: string
  trialEndsAt?: string | null
  gracePeriodEndsAt?: string | null
}) {
  return {
    user: opts.role ? { role: opts.role, tenant: opts.tenantId ?? 1 } : undefined,
    payload: {
      findByID: vi.fn().mockResolvedValue({
        status: opts.tenantStatus ?? 'active',
        trialEndsAt: opts.trialEndsAt ?? null,
        gracePeriodEndsAt: opts.gracePeriodEndsAt ?? null,
      }),
    },
  } as any
}

describe('withBillingLock', () => {
  it('passes through to inner when no user is present', async () => {
    const inner = vi.fn().mockReturnValue(true)
    const wrapped = withBillingLock(inner)
    expect(await wrapped({ req: makeReq({}) } as any)).toBe(true)
    expect(inner).toHaveBeenCalled()
  })

  it('passes through unconditionally for platformOwner regardless of status', async () => {
    const inner = vi.fn().mockReturnValue(true)
    const wrapped = withBillingLock(inner)
    const req = makeReq({ role: 'platformOwner', tenantStatus: 'past_due' })
    expect(await wrapped({ req } as any)).toBe(true)
  })

  it('returns false for tenant admin when tenant is past_due', async () => {
    const inner = vi.fn().mockReturnValue(true)
    const wrapped = withBillingLock(inner)
    const req = makeReq({ role: 'admin', tenantStatus: 'past_due' })
    expect(await wrapped({ req } as any)).toBe(false)
    expect(inner).not.toHaveBeenCalled()
  })

  it('passes through to inner when tenant is active', async () => {
    const inner = vi.fn().mockReturnValue(true)
    const wrapped = withBillingLock(inner)
    const req = makeReq({ role: 'admin', tenantStatus: 'active' })
    expect(await wrapped({ req } as any)).toBe(true)
  })

  it('passes through to inner when tenant is grandfathered', async () => {
    const inner = vi.fn().mockReturnValue(true)
    const wrapped = withBillingLock(inner)
    const req = makeReq({ role: 'admin', tenantStatus: 'grandfathered' })
    expect(await wrapped({ req } as any)).toBe(true)
  })

  it('returns false when grace period has not yet elapsed (canceled state)', async () => {
    const inner = vi.fn().mockReturnValue(true)
    const wrapped = withBillingLock(inner)
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    const req = makeReq({ role: 'admin', tenantStatus: 'canceled', gracePeriodEndsAt: future })
    expect(await wrapped({ req } as any)).toBe(false)
  })
})
