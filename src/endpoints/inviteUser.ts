import crypto from 'node:crypto'

import type { Endpoint, PayloadHandler } from 'payload'

type InviteBody = {
  email?: string
  role?: 'platformOwner' | 'admin' | 'staff' | 'kioskManager'
  tenant?: string | number | null
  firstName?: string
  lastName?: string
}

function extractId(rel: unknown): string | number | null {
  if (rel == null) return null
  if (typeof rel === 'object' && 'id' in rel) return (rel as { id: string | number }).id
  return rel as string | number
}

/**
 * Invite a new user by email.
 *
 * - Creates the user with a random password the caller never sees.
 * - Fires Payload's forgot-password flow to issue a one-time token and send
 *   an "invite" email (template customized in Users collection config).
 * - The recipient clicks the link in the email, lands on Payload's built-in
 *   `/admin/reset/<token>` page, sets their password, and is logged in.
 *
 * Access:
 *   - platformOwner can invite any role + any tenant (required for non-
 *     platformOwner roles).
 *   - admin can invite into their own tenant only, and only roles admin/staff.
 */
const handler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'platformOwner' && user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = ((await req.json?.()) ?? {}) as InviteBody
  const { email, role, tenant, firstName = '', lastName = '' } = body

  if (!email || !role) {
    return Response.json({ error: 'email and role are required' }, { status: 400 })
  }

  // Tenant-admin restrictions.
  let targetTenant: string | number | null | undefined = tenant ?? null
  if (user.role === 'admin') {
    if (role === 'platformOwner') {
      return Response.json(
        { error: 'Admins cannot invite platformOwners.' },
        { status: 403 },
      )
    }
    targetTenant = extractId((user as { tenant?: unknown }).tenant)
    if (!targetTenant) {
      return Response.json(
        { error: 'Your account has no tenant; cannot invite.' },
        { status: 400 },
      )
    }
  }
  if (role !== 'platformOwner' && !targetTenant) {
    return Response.json(
      { error: 'tenant is required for admin, staff, and kiosk manager roles.' },
      { status: 400 },
    )
  }

  // Bail if a user with this email already exists — avoids accidentally
  // overwriting via the create call.
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return Response.json(
      { error: `A user with email ${email} already exists.` },
      { status: 409 },
    )
  }

  // Random placeholder password — invite recipient sets their own via reset link.
  const placeholderPassword = crypto.randomBytes(32).toString('hex')

  try {
    await payload.create({
      collection: 'users',
      data: {
        email,
        password: placeholderPassword,
        role,
        tenant: role === 'platformOwner' ? null : (targetTenant as number),
        firstName,
        lastName,
      },
      overrideAccess: true,
    })
  } catch (err) {
    return Response.json(
      { error: (err as Error).message || 'Failed to create user.' },
      { status: 500 },
    )
  }

  try {
    // Generates token + sends email via the configured email adapter.
    await payload.forgotPassword({
      collection: 'users',
      data: { email },
    })
  } catch (err) {
    return Response.json(
      {
        error: `User created but invite email failed to send: ${(err as Error).message}`,
      },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, email })
}

export const inviteUserEndpoint: Endpoint = {
  path: '/invite-user',
  method: 'post',
  handler,
}
