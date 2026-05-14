import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { verifySecret } from '@/lib/kiosk/auth'
import { composeKioskState } from '@/lib/kiosk/composeState'
import { versionHash } from '@/lib/kiosk/versionHash'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const deviceId = req.headers.get('x-kiosk-device-id')
  const secret = req.headers.get('x-kiosk-secret')
  if (!deviceId || !secret) {
    return NextResponse.json({ error: 'missing-credentials' }, { status: 401 })
  }

  const payload = await getPayloadClient()
  if (!payload) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  const { docs } = await payload.find({
    collection: 'kiosks',
    where: { deviceId: { equals: deviceId } },
    limit: 1,
    overrideAccess: true,
  })

  const kiosk = docs[0]
  if (!kiosk || !kiosk.secretHash) {
    return NextResponse.json({ error: 'unknown-device' }, { status: 401 })
  }

  const ok = await verifySecret(secret, kiosk.secretHash)
  if (!ok) {
    return NextResponse.json({ error: 'bad-secret' }, { status: 401 })
  }

  const tenantId =
    typeof kiosk.tenant === 'object' && kiosk.tenant !== null && 'id' in kiosk.tenant
      ? (kiosk.tenant as { id: string | number }).id
      : kiosk.tenant
  if (!tenantId) {
    return NextResponse.json({ error: 'no-tenant' }, { status: 500 })
  }

  const tenantDoc = await payload.findByID({
    collection: 'tenants',
    id: tenantId as string | number,
    overrideAccess: true,
  })

  const now = new Date()
  const overrideIds =
    kiosk.overrideEnabled && Array.isArray(kiosk.slideOverrides)
      ? kiosk.slideOverrides.map((rel: any) =>
          String(rel?.value?.id ?? rel?.value ?? rel?.id ?? rel),
        )
      : null

  const broadcastAt = (tenantDoc as any).kioskBroadcastAt ?? null
  const pushAt = (kiosk as any).kioskPushAt ?? null

  const { slides, tenant } = await composeKioskState({
    payload: payload as any,
    tenantId: String(tenantId),
    now,
    overrideIds,
    broadcastAt,
    pushAt,
  })

  // Pick the schedule whose date range covers today, not just the latest one.
  const todayIso = now.toISOString()
  const schedules = await payload.find({
    collection: 'prayer-schedules',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { startDate: { less_than_equal: todayIso } },
        {
          or: [
            { endDate: { greater_than_equal: todayIso } },
            { endDate: { exists: false } },
          ],
        },
      ],
    },
    sort: '-startDate',
    limit: 1,
    overrideAccess: true,
  })
  const prayerTimes = schedules.docs[0] ?? null

  const dayKey = now.toISOString().slice(0, 10)
  const version = versionHash({
    slideIds: slides.map((s) => `${s.type}:${s.id}`),
    slideUpdatedAts: slides.map((s) => s.updatedAt),
    day: dayKey,
    broadcastAt,
    pushAt,
  })

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  await payload.update({
    collection: 'kiosks',
    id: kiosk.id,
    overrideAccess: true,
    data: {
      lastSeenAt: now.toISOString(),
      lastSeenIp: ip,
      userAgent: req.headers.get('user-agent') ?? null,
      status: 'ONLINE',
    },
  })

  return NextResponse.json({
    tenant,
    prayerTimes,
    slides,
    version,
    pollIntervalMs: 60_000,
  })
}
