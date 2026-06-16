import type { Access, PayloadRequest } from 'payload'

/** Extract a tenant id from a user's tenant field (object or primitive). */
const getTenantId = (tenant: unknown): string | number | null => {
  if (!tenant) return null
  if (typeof tenant === 'object' && tenant !== null && 'id' in tenant) {
    return (tenant as { id: string | number }).id
  }
  return tenant as string | number
}

const roleOf = (user: unknown): string | undefined =>
  (user as { role?: string } | null | undefined)?.role

const tenantOf = (user: unknown) =>
  getTenantId((user as { tenant?: unknown } | null | undefined)?.tenant)

/** Roles that may create/update/delete school records across their tenant. */
const WRITE_ROLES = ['admin', 'school_admin']

/**
 * Read: platformOwner sees all; admin/school_admin/staff are tenant-scoped.
 * (Teacher read is handled per-collection by the async helpers added later.)
 */
export const schoolTenantRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  const tenantId = tenantOf(user)
  if (!tenantId) return false
  if (WRITE_ROLES.includes(roleOf(user)!) || roleOf(user) === 'staff') {
    return { tenant: { equals: tenantId } }
  }
  return false
}

/** Create/update/delete: platformOwner all; admin/school_admin tenant-scoped; others denied. */
export const schoolTenantWrite: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  const tenantId = tenantOf(user)
  if (!tenantId) return false
  if (WRITE_ROLES.includes(roleOf(user)!)) return { tenant: { equals: tenantId } }
  return false
}

/** Create needs a boolean (no `where`): platformOwner / admin / school_admin within a tenant. */
export const schoolTenantCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  if (!tenantOf(user)) return false
  return WRITE_ROLES.includes(roleOf(user)!)
}

// ---- shared internals reused by the async teacher helpers (added later) ----
export { getTenantId, roleOf, tenantOf, WRITE_ROLES }
export type { PayloadRequest }
