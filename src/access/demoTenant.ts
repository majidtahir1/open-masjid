import type { PayloadRequest } from 'payload'

/** Resolve a relationship value (scalar id or populated `{ id }`) to its id. */
function relId(rel: unknown): string | number | null {
  if (rel == null) return null
  if (typeof rel === 'object' && 'id' in (rel as object)) {
    return (rel as { id: string | number }).id
  }
  return rel as string | number
}

/**
 * True when the acting user is a NON-platformOwner whose tenant is a demo
 * tenant (`demoMode: true`). Used to lock down sensitive writes for the shared,
 * publicly-credentialed demo admin (it is otherwise a normal `admin` role).
 *
 * platformOwner and server-side `overrideAccess` paths (no `req.user`, or the
 * seed's platformOwner req) are never treated as demo — so seeding/reset still
 * works.
 */
export async function actingUserInDemoTenant(req: PayloadRequest): Promise<boolean> {
  const user = req?.user as { role?: string; tenant?: unknown } | null
  if (!user || user.role === 'platformOwner') return false
  const tenantId = relId(user.tenant)
  if (!tenantId) return false
  try {
    const doc = await req.payload.findByID({
      collection: 'tenants',
      id: tenantId,
      overrideAccess: true,
      depth: 0,
    })
    return Boolean((doc as { demoMode?: boolean | null } | null)?.demoMode)
  } catch {
    return false
  }
}
