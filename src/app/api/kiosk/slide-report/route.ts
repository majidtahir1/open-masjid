import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { verifySecret } from '@/lib/kiosk/auth'

export const runtime = 'nodejs'

/**
 * Kiosk-device-authenticated endpoint. The display page POSTs here whenever
 * it advances to a new slide; we persist the current-slide metadata on the
 * Kiosk record so admins can monitor in real time.
 *
 * Body: { title, type, index, total, durationMs, startedAt }
 */
export async function POST(req: Request) {
  const deviceId = req.headers.get('x-kiosk-device-id')
  const secret = req.headers.get('x-kiosk-secret')
  if (!deviceId || !secret) {
    return NextResponse.json({ error: 'missing-credentials' }, { status: 401 })
  }

  const payload = await getPayloadClient()
  if (!payload) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const { docs } = await payload.find({
    collection: 'kiosks',
    where: { deviceId: { equals: deviceId } },
    limit: 1,
    overrideAccess: true,
  })
  const kiosk = docs[0] as any
  if (!kiosk?.secretHash) return NextResponse.json({ error: 'unknown-device' }, { status: 401 })

  const ok = await verifySecret(secret, kiosk.secretHash)
  if (!ok) return NextResponse.json({ error: 'bad-secret' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const currentSlide = {
    title: typeof body?.title === 'string' ? body.title.slice(0, 300) : null,
    type: typeof body?.type === 'string' ? body.type.slice(0, 50) : null,
    index: Number.isFinite(body?.index) ? Number(body.index) : null,
    total: Number.isFinite(body?.total) ? Number(body.total) : null,
    durationMs: Number.isFinite(body?.durationMs) ? Number(body.durationMs) : null,
    startedAt:
      typeof body?.startedAt === 'string' && !Number.isNaN(Date.parse(body.startedAt))
        ? body.startedAt
        : new Date().toISOString(),
  }

  await payload.update({
    collection: 'kiosks',
    id: kiosk.id,
    overrideAccess: true,
    data: { currentSlide },
  })

  return NextResponse.json({ ok: true })
}
