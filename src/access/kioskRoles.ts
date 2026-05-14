import type { Access } from 'payload'

/**
 * Wraps an Access function so `kioskManager` users are always denied.
 * Use on collections that should be invisible to kiosk-only admins.
 */
export const denyKioskManager = (inner: Access): Access => (args) => {
  const user = args.req.user as { role?: string } | null | undefined
  if (user?.role === 'kioskManager') return false
  return inner(args)
}

/**
 * Allow kioskManager read-only access (tenant-scoped); defer to inner for everything else.
 */
export const allowKioskManagerRead = (inner: Access): Access => (args) => {
  const user = args.req.user as
    | { role?: string; tenant?: unknown }
    | null
    | undefined
  if (user?.role === 'kioskManager') {
    const t = user.tenant as { id?: string | number } | string | number | null | undefined
    const tenantId =
      typeof t === 'object' && t !== null && 'id' in t ? t.id : (t as string | number | null | undefined)
    if (!tenantId) return false
    return { tenant: { equals: tenantId } }
  }
  return inner(args)
}
