import type { Access } from 'payload'

/**
 * Extracts a tenant id from a user's tenant field (which may be an object
 * or a primitive id depending on depth).
 */
const getTenantId = (tenant: unknown): string | number | null => {
  if (!tenant) return null
  if (typeof tenant === 'object' && tenant !== null && 'id' in tenant) {
    return (tenant as { id: string | number }).id
  }
  return tenant as string | number
}

/**
 * Read: platformOwner sees everything; tenant users only see docs in their tenant.
 */
export const tenantScopedRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'platformOwner') return true
  const tenantId = getTenantId((user as { tenant?: unknown }).tenant)
  if (!tenantId) return false
  return { tenant: { equals: tenantId } }
}

/**
 * Create: platformOwner can always create. Tenant users can create only within
 * their tenant (the beforeChange hook will also force-set tenant from user).
 */
export const tenantScopedCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'platformOwner') return true
  const tenantId = getTenantId((user as { tenant?: unknown }).tenant)
  return Boolean(tenantId)
}

/**
 * Update: platformOwner can update anything; tenant users can only update
 * docs belonging to their tenant.
 */
export const tenantScopedUpdate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'platformOwner') return true
  const tenantId = getTenantId((user as { tenant?: unknown }).tenant)
  if (!tenantId) return false
  return { tenant: { equals: tenantId } }
}

/**
 * Delete: same rules as update.
 */
export const tenantScopedDelete: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'platformOwner') return true
  const tenantId = getTenantId((user as { tenant?: unknown }).tenant)
  if (!tenantId) return false
  return { tenant: { equals: tenantId } }
}

/**
 * Admin + staff in tenant can do X (for non-sensitive ops).
 */
export const tenantScopedAdminOrStaff: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'platformOwner') return true
  const tenantId = getTenantId((user as { tenant?: unknown }).tenant)
  if (!tenantId) return false
  return { tenant: { equals: tenantId } }
}

/**
 * Only platform owners.
 */
export const platformOwnerOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  return user.role === 'platformOwner'
}
