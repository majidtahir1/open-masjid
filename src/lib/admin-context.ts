import { cache } from 'react'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

export const getAdminUser = cache(async () => {
  const payload = await getPayload({ config })
  const { user, permissions } = await payload.auth({ headers: await nextHeaders() })
  return { payload, user, permissions }
})

export const getAdminTenant = cache(async (tenantId: string | number) => {
  const { payload } = await getAdminUser()
  return payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
})

// Same tenant lookup but with depth: 1 so relation fields like branding.logo
// and branding.favicon are populated. Cached separately from depth: 0.
export const getAdminTenantWithRelations = cache(async (tenantId: string | number) => {
  const { payload } = await getAdminUser()
  return payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 1,
    overrideAccess: true,
  })
})
