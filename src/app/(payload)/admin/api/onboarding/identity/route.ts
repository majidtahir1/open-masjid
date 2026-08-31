import { NextResponse } from 'next/server'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

type Body = {
  name?: string
  footerTagline?: string
  footerLegalNote?: string
  contactInfo?: {
    address?: string
    phone?: string
    email?: string
    zelle?: string
    zelleQrCode?: number | string | null
  }
  socialLinks?: Array<{ platform: string; url: string }>
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
    contactInfo?: Record<string, unknown> | null
  }

  const data: Record<string, unknown> = {}

  if (typeof body.name === 'string' && body.name.length > 0) {
    data.name = body.name
  }
  if (typeof body.footerTagline === 'string') {
    data.footerTagline = body.footerTagline
  }
  if (typeof body.footerLegalNote === 'string') {
    data.footerLegalNote = body.footerLegalNote
  }

  if (body.contactInfo && typeof body.contactInfo === 'object') {
    const existing = tenant.contactInfo ?? {}
    const next: Record<string, unknown> = { ...existing }
    if (typeof body.contactInfo.address === 'string') next.address = body.contactInfo.address
    if (typeof body.contactInfo.phone === 'string') next.phone = body.contactInfo.phone
    if (typeof body.contactInfo.email === 'string') next.email = body.contactInfo.email
    if (typeof body.contactInfo.zelle === 'string') next.zelle = body.contactInfo.zelle
    if ('zelleQrCode' in body.contactInfo) {
      const qr = body.contactInfo.zelleQrCode
      // Media ids are integers; coerce numeric strings so the relationship
      // validator doesn't reject them. Anything unparseable clears the field.
      next.zelleQrCode =
        qr == null || qr === '' || Number.isNaN(Number(qr)) ? null : Number(qr)
    }
    data.contactInfo = next
  }

  if (Array.isArray(body.socialLinks)) {
    data.socialLinks = body.socialLinks
      .filter((s) => s && typeof s.url === 'string' && s.url.trim().length > 0)
      .map((s) => ({ platform: s.platform, url: s.url.trim() }))
  }

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data,
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
