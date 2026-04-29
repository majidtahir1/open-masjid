import { NextResponse } from 'next/server'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

type Body = {
  logoMediaId?: number | string | null
  faviconMediaId?: number | string | null
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  displayFont?: string
  markComplete?: boolean
}

function tenantIdOf(t: unknown): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && t !== null && 'id' in t) {
    return (t as { id: string | number }).id
  }
  return t as string | number
}

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const tenantId = tenantIdOf((user as { tenant?: unknown }).tenant)
  if (!tenantId) return NextResponse.json({ error: 'no-tenant' }, { status: 400 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }

  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as {
    branding?: Record<string, unknown> | null
    onboarding?: Record<string, string | null> | null
  }

  const existingBranding = tenant.branding ?? {}
  const branding: Record<string, unknown> = { ...existingBranding }

  if (body.logoMediaId !== undefined) {
    branding.logo = body.logoMediaId
  }
  if ('faviconMediaId' in body) {
    branding.favicon = body.faviconMediaId
  }
  if (typeof body.primaryColor === 'string') {
    branding.primaryColor = body.primaryColor
  }
  if (typeof body.secondaryColor === 'string') {
    branding.secondaryColor = body.secondaryColor
  }
  if (typeof body.accentColor === 'string') {
    branding.accentColor = body.accentColor
  }
  if (typeof body.displayFont === 'string') {
    branding.displayFont = body.displayFont
  }

  const data: Record<string, unknown> = { branding }

  if (body.markComplete) {
    const onboarding = { ...(tenant.onboarding ?? {}) }
    onboarding.branding = 'complete'
    data.onboarding = onboarding
  }

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data,
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
