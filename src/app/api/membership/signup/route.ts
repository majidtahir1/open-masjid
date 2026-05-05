/**
 * POST /api/membership/signup
 *
 * Free-tier signup. Form-encoded fields:
 *   - tierId  (required)
 *   - name    (required)
 *   - email   (required)
 *   - phone   (optional)
 *
 * Validates tier is free + active, find-or-creates a Member by (tenant, email),
 * then redirects to /membership/thanks?free=1.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import {
  buildFreeMemberData,
  validateFreeSignup,
  type FreeTierLike,
} from '@/lib/membership-signup'

export async function POST(req: Request) {
  const tenant = await getCurrentTenant()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const form = await req.formData()
  const tierId = form.get('tierId')
  if (!tierId || typeof tierId !== 'string') {
    return NextResponse.json({ error: 'Missing tierId' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  const tier = (await payload.findByID({
    collection: 'membership-tiers',
    id: tierId,
    overrideAccess: true,
  })) as FreeTierLike & { tenant?: unknown }

  if (!tier) return NextResponse.json({ error: 'Tier not found' }, { status: 404 })

  // Cross-tenant check: tier must belong to the current tenant
  const tierTenantId =
    typeof tier.tenant === 'object' && tier.tenant !== null && 'id' in (tier.tenant as object)
      ? (tier.tenant as { id: string | number }).id
      : (tier.tenant as string | number | undefined)
  if (tierTenantId !== tenant.id) {
    return NextResponse.json({ error: 'Tier not found' }, { status: 404 })
  }

  let validated
  try {
    validated = validateFreeSignup(
      {
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: form.get('phone') == null ? null : String(form.get('phone')),
      },
      tier,
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid input' },
      { status: 400 },
    )
  }

  // Find-or-create by (tenant, email) — preserve original joinedAt
  const existing = await payload.find({
    collection: 'members',
    where: {
      tenant: { equals: tenant.id },
      email: { equals: validated.email },
    },
    limit: 1,
    overrideAccess: true,
  })

  const existingDoc = existing.docs[0] as
    | { id: string | number; joinedAt?: string | null }
    | undefined

  const data = buildFreeMemberData(
    tenant.id,
    tier.id,
    validated,
    existingDoc?.joinedAt ?? null,
  )

  // Payload's generated types narrow tenant/tier to number; coerce here so
  // the helper can stay generic across string/number ids.
  const persistData = {
    ...data,
    tenant: Number(data.tenant),
    tier: Number(data.tier),
  }

  if (existingDoc) {
    await payload.update({
      collection: 'members',
      id: existingDoc.id,
      data: persistData,
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'members',
      data: persistData,
      overrideAccess: true,
    })
  }

  const origin =
    req.headers.get('origin') ??
    `https://${(tenant as { slug?: string }).slug ?? ''}.openmasjid.app`
  return NextResponse.redirect(`${origin}/membership/thanks?free=1`, 303)
}
