import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await getPayloadClient()
  if (!payload) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  const auth = await payload.auth({ headers: await headers() })
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const kioskId = typeof body?.kioskId === 'string' ? body.kioskId : null
  if (!kioskId) return NextResponse.json({ error: 'kioskId-required' }, { status: 400 })

  try {
    await payload.findByID({
      collection: 'kiosks',
      id: kioskId,
      user: auth.user,
      overrideAccess: false,
    })
  } catch {
    return NextResponse.json({ error: 'not-found' }, { status: 404 })
  }

  await payload.update({
    collection: 'kiosks',
    id: kioskId,
    data: {
      deviceId: null,
      secretHash: null,
      pairingCode: null,
      pairingCodeExpiresAt: null,
      status: 'UNPAIRED',
      lastSeenAt: null,
    },
    user: auth.user,
    overrideAccess: false,
  })

  return NextResponse.json({ ok: true })
}
