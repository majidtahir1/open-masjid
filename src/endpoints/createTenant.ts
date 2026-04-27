import crypto from 'node:crypto'

import type { Endpoint, PayloadHandler } from 'payload'

type CreateTenantBody = {
  name?: string
  slug?: string
  siteType?: 'masjid' | 'umbrella'
  adminEmail?: string
  adminFirstName?: string
  adminLastName?: string
}

/**
 * Platform-owner tenant onboarding.
 *
 * Creates a Tenant row, then creates the first admin user for that tenant,
 * then fires Payload's forgot-password flow to email the admin a one-time
 * link to set their password. The platform owner never needs to hand-edit
 * the DB or copy-paste credentials.
 *
 * Rolls back the created tenant if anything after the tenant insert fails,
 * so a partial run doesn't leave an orphaned tenant with no admin.
 */
const handler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'platformOwner') {
    return Response.json(
      { error: 'Only platform owners can create tenants.' },
      { status: 403 },
    )
  }

  const body = ((await req.json?.()) ?? {}) as CreateTenantBody
  const {
    name,
    slug,
    siteType,
    adminEmail,
    adminFirstName = '',
    adminLastName = '',
  } = body

  if (!name || !slug || !siteType || !adminEmail) {
    return Response.json(
      { error: 'name, slug, siteType, and adminEmail are required.' },
      { status: 400 },
    )
  }
  if (siteType !== 'masjid' && siteType !== 'umbrella') {
    return Response.json({ error: 'Invalid siteType.' }, { status: 400 })
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return Response.json(
      { error: 'Slug must be lowercase letters, numbers, and hyphens only.' },
      { status: 400 },
    )
  }

  const existingTenant = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingTenant.docs.length > 0) {
    return Response.json(
      { error: `A tenant with slug "${slug}" already exists.` },
      { status: 409 },
    )
  }

  const existingUser = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingUser.docs.length > 0) {
    return Response.json(
      { error: `A user with email ${adminEmail} already exists.` },
      { status: 409 },
    )
  }

  let tenantId: string | number | null = null
  try {
    const tenant = (await payload.create({
      collection: 'tenants',
      data: { name, slug, siteType },
      overrideAccess: true,
    })) as { id: string | number }
    tenantId = tenant.id

    const placeholderPassword = crypto.randomBytes(32).toString('hex')
    await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: placeholderPassword,
        role: 'admin',
        tenant: tenantId as number,
        firstName: adminFirstName,
        lastName: adminLastName,
      },
      overrideAccess: true,
    })

    await payload.forgotPassword({
      collection: 'users',
      data: { email: adminEmail },
    })

    return Response.json({ ok: true, tenantId, adminEmail })
  } catch (err) {
    // Roll back the tenant if user or email step failed.
    if (tenantId) {
      try {
        await payload.delete({
          collection: 'tenants',
          id: tenantId,
          overrideAccess: true,
        })
      } catch {
        // Best effort — leave a log line for debugging.
        payload.logger.error(
          `createTenant: failed to roll back tenant ${tenantId} after failure`,
        )
      }
    }
    return Response.json(
      { error: (err as Error).message || 'Failed to create tenant.' },
      { status: 500 },
    )
  }
}

export const createTenantEndpoint: Endpoint = {
  path: '/create-tenant',
  method: 'post',
  handler,
}
