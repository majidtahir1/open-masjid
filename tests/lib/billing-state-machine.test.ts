import { describe, it, expect } from 'vitest'
import { getTenantBillingState, isAdminLocked, isPublicSiteOffline, isPublicSiteReadOnly } from '@/lib/billing'

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

  it('returns pending state for a never-logged-in tenant', () => {
    const t = { status: 'pending' as const, trialEndsAt: null, gracePeriodEndsAt: null }
    expect(getTenantBillingState(t, NOW).kind).toBe('pending')
  })

  it('returns past_due (subscription) for past_due status', () => {
    const t = { status: 'past_due' as const, trialEndsAt: null, gracePeriodEndsAt: null }
    const s = getTenantBillingState(t, NOW)
    expect(s.kind).toBe('past_due')
    expect(isAdminLocked(s)).toBe(true)
  })

  it('isPublicSiteReadOnly is true for past_due_trial, past_due, and grace_period only', () => {
    const states = [
      getTenantBillingState({ status: 'trialing', trialEndsAt: '2026-04-30T12:00:00Z', gracePeriodEndsAt: null }, NOW), // past_due_trial
      getTenantBillingState({ status: 'past_due', trialEndsAt: null, gracePeriodEndsAt: null }, NOW),
      getTenantBillingState({ status: 'canceled', trialEndsAt: null, gracePeriodEndsAt: '2026-05-15T00:00:00Z' }, NOW), // grace_period
    ]
    for (const s of states) expect(isPublicSiteReadOnly(s)).toBe(true)

    const notReadOnly = [
      getTenantBillingState({ status: 'pending', trialEndsAt: null, gracePeriodEndsAt: null }, NOW),
      getTenantBillingState({ status: 'trialing', trialEndsAt: '2026-05-08T12:00:00Z', gracePeriodEndsAt: null }, NOW),
      getTenantBillingState({ status: 'active', trialEndsAt: null, gracePeriodEndsAt: null }, NOW),
      getTenantBillingState({ status: 'grandfathered', trialEndsAt: null, gracePeriodEndsAt: null }, NOW),
      getTenantBillingState({ status: 'canceled', trialEndsAt: null, gracePeriodEndsAt: '2026-04-15T00:00:00Z' }, NOW), // offline
    ]
    for (const s of notReadOnly) expect(isPublicSiteReadOnly(s)).toBe(false)
  })
})
