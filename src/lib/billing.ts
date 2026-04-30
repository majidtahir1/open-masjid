export type TenantStatus =
  | 'pending'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'offline'
  | 'grandfathered'

export interface BillingTenantFields {
  status: TenantStatus
  trialEndsAt: string | null
  gracePeriodEndsAt: string | null
}

export type BillingState =
  | { kind: 'pending' }
  | { kind: 'trial'; daysRemaining: number }
  | { kind: 'past_due_trial' }
  | { kind: 'active' }
  | { kind: 'past_due' }
  | { kind: 'grace_period'; daysRemaining: number }
  | { kind: 'offline' }
  | { kind: 'grandfathered' }

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function getTenantBillingState(t: BillingTenantFields, now: Date = new Date()): BillingState {
  switch (t.status) {
    case 'grandfathered':
      return { kind: 'grandfathered' }
    case 'pending':
      return { kind: 'pending' }
    case 'active':
      return { kind: 'active' }
    case 'past_due':
      return { kind: 'past_due' }
    case 'trialing': {
      if (!t.trialEndsAt) return { kind: 'past_due_trial' }
      const end = new Date(t.trialEndsAt)
      if (end <= now) return { kind: 'past_due_trial' }
      return { kind: 'trial', daysRemaining: daysBetween(now, end) }
    }
    case 'canceled':
    case 'offline': {
      if (!t.gracePeriodEndsAt) return { kind: 'offline' }
      const end = new Date(t.gracePeriodEndsAt)
      if (end <= now) return { kind: 'offline' }
      return { kind: 'grace_period', daysRemaining: daysBetween(now, end) }
    }
  }
}

export function isAdminLocked(s: BillingState): boolean {
  return (
    s.kind === 'past_due_trial' ||
    s.kind === 'past_due' ||
    s.kind === 'grace_period' ||
    s.kind === 'offline'
  )
}

export function isPublicSiteOffline(s: BillingState): boolean {
  return s.kind === 'offline'
}

export function isPublicSiteReadOnly(s: BillingState): boolean {
  return s.kind === 'past_due_trial' || s.kind === 'past_due' || s.kind === 'grace_period'
}
