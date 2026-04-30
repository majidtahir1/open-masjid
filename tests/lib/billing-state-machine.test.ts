import { describe, it, expect } from 'vitest'
import { getTenantBillingState, isAdminLocked, isPublicSiteOffline } from '@/lib/billing'

const NOW = new Date('2026-05-01T12:00:00Z')

describe('getTenantBillingState', () => {
  it('returns trial state with daysRemaining when trialing and trial not expired', () => {
    const t = { status: 'trialing' as const, trialEndsAt: '2026-05-08T12:00:00Z', gracePeriodEndsAt: null }
    const s = getTenantBillingState(t, NOW)
    expect(s.kind).toBe('trial')
    if (s.kind === 'trial') expect(s.daysRemaining).toBe(7)
  })

  it('returns past_due_trial when trialing and trial has expired', () => {
    const t = { status: 'trialing' as const, trialEndsAt: '2026-04-30T12:00:00Z', gracePeriodEndsAt: null }
    const s = getTenantBillingState(t, NOW)
    expect(s.kind).toBe('past_due_trial')
  })

  it('returns active for active subscriptions', () => {
    const t = { status: 'active' as const, trialEndsAt: null, gracePeriodEndsAt: null }
    expect(getTenantBillingState(t, NOW).kind).toBe('active')
  })

  it('returns grandfathered (never enforced) for legacy tenants', () => {
    const t = { status: 'grandfathered' as const, trialEndsAt: null, gracePeriodEndsAt: null }
    const s = getTenantBillingState(t, NOW)
    expect(s.kind).toBe('grandfathered')
    expect(isAdminLocked(s)).toBe(false)
    expect(isPublicSiteOffline(s)).toBe(false)
  })

  it('returns offline when canceled and grace period has elapsed', () => {
    const t = { status: 'canceled' as const, trialEndsAt: null, gracePeriodEndsAt: '2026-04-15T00:00:00Z' }
    const s = getTenantBillingState(t, NOW)
    expect(s.kind).toBe('offline')
    expect(isPublicSiteOffline(s)).toBe(true)
    expect(isAdminLocked(s)).toBe(true)
  })

  it('returns grace_period when canceled but grace not yet elapsed', () => {
    const t = { status: 'canceled' as const, trialEndsAt: null, gracePeriodEndsAt: '2026-05-15T00:00:00Z' }
    const s = getTenantBillingState(t, NOW)
    expect(s.kind).toBe('grace_period')
    expect(isAdminLocked(s)).toBe(true)
    expect(isPublicSiteOffline(s)).toBe(false)
  })
})
