import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as { id: string; role?: string; tenant?: any } | null
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const deviceId = url.searchParams.get('deviceId')
  const documentId = url.searchParams.get('documentId')
  const tenantQ = url.searchParams.get('tenant')

  const now = new Date().toISOString()

  if (documentId) {
    try {
      await payload.findByID({
        collection: 'kiosks',
        id: documentId,
        user: auth.user,
        overrideAccess: false,
      })
    } catch {
      return NextResponse.json({ error: 'not-found' }, { status: 404 })
    }
    await payload.update({
      collection: 'kiosks',
      id: documentId,
      data: { kioskPushAt: now },
      user: auth.user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true })
  }

  if (deviceId) {
    const { docs } = await payload.find({
      collection: 'kiosks',
      where: { deviceId: { equals: deviceId } },
      limit: 1,
      user: auth.user,
      overrideAccess: false,
    })
    if (!docs[0]) return NextResponse.json({ error: 'not-found' }, { status: 404 })
    await payload.update({
      collection: 'kiosks',
      id: docs[0].id,
      data: { kioskPushAt: now },
      user: auth.user,
      overrideAccess: false,
    })
    return NextResponse.json({ ok: true })
  }

  const userTenantId =
    typeof user.tenant === 'object' && user.tenant !== null && 'id' in user.tenant
      ? (user.tenant as { id: string | number }).id
      : user.tenant
  const tenantId = tenantQ || userTenantId
  if (!tenantId) return NextResponse.json({ error: 'tenant-required' }, { status: 400 })
  if (
    user.role !== 'platformOwner' &&
    String(tenantId) !== String(userTenantId)
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await payload.update({
    collection: 'tenants',
    id: tenantId as string | number,
    data: { kioskBroadcastAt: now },
    user: auth.user,
    overrideAccess: false,
  })
  return NextResponse.json({ ok: true })
}
