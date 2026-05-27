import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await getPayloadClient()
  if (!payload) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as { id: string; role?: string; tenant?: any } | null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action = body?.action === 'end' ? 'end' : 'start'

  const userTenantId =
    typeof user.tenant === 'object' && user.tenant !== null && 'id' in user.tenant
      ? (user.tenant as { id: string | number }).id
      : user.tenant
  const tenantId = body?.tenant || userTenantId
  if (!tenantId) return NextResponse.json({ error: 'tenant-required' }, { status: 400 })
  if (user.role !== 'platformOwner' && String(tenantId) !== String(userTenantId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const tenantDoc = await payload.findByID({
    collection: 'tenants',
    id: tenantId as string | number,
    user: auth.user,
    overrideAccess: false,
  })
  const holdover = Number((tenantDoc as any).prayerDisplay?.salahHoldoverMinutes ?? 5)
  const now = new Date()

  const data =
    action === 'start'
      ? {
          kioskBroadcastAt: now.toISOString(),
          prayerDisplay: {
            ...((tenantDoc as any).prayerDisplay ?? {}),
            salahManualUntil: new Date(now.getTime() + holdover * 60_000).toISOString(),
            salahManualClearedAt: null,
          },
        }
      : {
          kioskBroadcastAt: now.toISOString(),
          prayerDisplay: {
            ...((tenantDoc as any).prayerDisplay ?? {}),
            salahManualClearedAt: now.toISOString(),
          },
        }

  await payload.update({
    collection: 'tenants',
    id: tenantId as string | number,
    data,
    user: auth.user,
    overrideAccess: false,
  })

  return NextResponse.json({ ok: true, action })
}
