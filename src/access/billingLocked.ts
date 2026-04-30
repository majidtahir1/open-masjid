import type { Access } from 'payload'
import { getTenantBillingState, isAdminLocked, type BillingTenantFields } from '@/lib/billing'

/**
 * Wrap an existing Access function so that it returns false when the
 * caller's tenant is in a billing-locked state (past_due_trial, past_due,
 * grace_period, offline). PlatformOwners bypass the lock entirely.
 *
 * Read access is intentionally NOT wrapped anywhere — the public site needs
 * to keep rendering during grace period.
 */
export function withBillingLock(inner: Access): Access {
  return async (args) => {
    const u = args.req.user as { role?: string; tenant?: unknown } | undefined
    if (!u) return inner(args)
    if (u.role === 'platformOwner') return inner(args)
    const tenantId =
      typeof u.tenant === 'object' && u.tenant !== null && 'id' in u.tenant
        ? (u.tenant as { id: string | number }).id
        : (u.tenant as string | number | undefined)
    if (!tenantId) return inner(args)
    const tenantDoc = (await args.req.payload.findByID({
      collection: 'tenants',
      id: tenantId,
      overrideAccess: true,
    })) as BillingTenantFields | null
    if (!tenantDoc) return inner(args)
    const state = getTenantBillingState(tenantDoc)
    if (isAdminLocked(state)) return false
    return inner(args)
  }
}
