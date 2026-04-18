import type { CollectionBeforeChangeHook } from 'payload'

/**
 * On create, force the `tenant` field to match the authenticated user's tenant
 * unless the user is a platformOwner. Prevents staff/admins from creating
 * records in other tenants by tampering with form data or API payloads.
 */
export const setTenantFromUser: CollectionBeforeChangeHook = ({
  data,
  req,
  operation,
}) => {
  if (operation !== 'create') return data

  const user = req.user as
    | { role?: string; tenant?: string | number | { id: string | number } }
    | null
    | undefined

  if (!user) return data
  if (user.role === 'platformOwner') return data

  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? user.tenant.id
      : user.tenant

  if (tenantId) {
    return {
      ...data,
      tenant: tenantId,
    }
  }

  return data
}
