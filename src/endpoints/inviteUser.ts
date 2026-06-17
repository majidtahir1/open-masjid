import crypto from 'node:crypto'

import type { Endpoint, PayloadHandler } from 'payload'

import { isDemoTenant } from '../lib/demo/guard'

type InviteRole = 'platformOwner' | 'admin' | 'staff' | 'kioskManager' | 'teacher' | 'school_admin'
type InviteBody = {
  email?: string
  role?: InviteRole
  tenant?: string | number | null
  firstName?: string
  lastName?: string
}

type ActingCtx = { actingRole?: string; actingTenant: string | number | null }
type InviteDecision =
  | { ok: true; targetTenant: string | number | null }
  | { ok: false; error: string; status: number }

/** Elevated roles only platformOwner may grant. */
const ELEVATED_ROLES = new Set(['platformOwner', 'admin', 'school_admin'])
const SELF_SERVE_INVITERS = new Set(['platformOwner', 'admin', 'school_admin'])

/**
 * Pure authorization decision for an invite. No Payload access.
 * - platformOwner: any role; platformOwner target gets tenant null, others use supplied tenant.
 * - admin / school_admin: may invite only teacher/staff/kioskManager, forced into their own tenant.
 */
export function authorizeInvite(
  ctx: ActingCtx,
  body: { role?: string; tenant?: string | number | null },
): InviteDecision {
  if (!ctx.actingRole || !SELF_SERVE_INVITERS.has(ctx.actingRole)) {
    return { ok: false, error: 'Forbidden', status: 403 }
  }
  if (!body.role) return { ok: false, error: 'email and role are required', status: 400 }

  if (ctx.actingRole === 'platformOwner') {
    return { ok: true, targetTenant: body.role === 'platformOwner' ? null : (body.tenant ?? null) }
  }

  // admin or school_admin
  if (ELEVATED_ROLES.has(body.role)) {
    return { ok: false, error: `You cannot invite ${body.role}.`, status: 403 }
  }
  if (!ctx.actingTenant) {
    return { ok: false, error: 'Your account has no tenant; cannot invite.', status: 400 }
  }
  return { ok: true, targetTenant: ctx.actingTenant }
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

  const body = ((await req.json?.()) ?? {}) as InviteBody
  const { email, role, firstName = '', lastName = '' } = body

  if (!email) return Response.json({ error: 'email and role are required' }, { status: 400 })

  const decision = authorizeInvite(
    { actingRole: user.role, actingTenant: extractId((user as { tenant?: unknown }).tenant) },
    { role, tenant: body.tenant ?? null },
  )
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status })
  const targetTenant = decision.targetTenant

  // Demo-tenant guard (only applies when inviting into a concrete tenant).
  if (user.role !== 'platformOwner' && targetTenant) {
    const actingTenant = await payload.findByID({
      collection: 'tenants',
      id: targetTenant,
      overrideAccess: true,
    })
    if (isDemoTenant(actingTenant as { demoMode?: boolean | null })) {
      return Response.json(
        { error: 'Invites are disabled for the demo tenant.' },
        { status: 403 },
      )
    }
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
        role: role as NonNullable<InviteRole>,
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
