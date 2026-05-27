import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { isValidPairingCode, normalizePairingCode } from '@/lib/kiosk/pairingCode'
import { generateDeviceSecret, hashSecret } from '@/lib/kiosk/auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const code = typeof body?.code === 'string' ? body.code : ''

  if (!code || !isValidPairingCode(code)) {
    return NextResponse.json({ status: 'invalid' }, { status: 400 })
  }

  const normalized = normalizePairingCode(code)
  const payload = await getPayloadClient()
  if (!payload) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const { docs } = await payload.find({
    collection: 'kiosks',
    where: { pairingCode: { equals: normalized } },
    limit: 1,
    overrideAccess: true,
  })

  const kiosk = docs[0]
  if (!kiosk) return NextResponse.json({ status: 'pending' }, { status: 404 })

  const expiresAt = kiosk.pairingCodeExpiresAt
    ? new Date(kiosk.pairingCodeExpiresAt as string)
    : null
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ status: 'expired' }, { status: 410 })
  }

  if (kiosk.deviceId && kiosk.secretHash) {
    return NextResponse.json({ status: 'already-paired' }, { status: 409 })
  }

  const deviceId = crypto.randomUUID()
  const secret = generateDeviceSecret()
  const secretHash = await hashSecret(secret)

  await payload.update({
    collection: 'kiosks',
    id: kiosk.id,
    overrideAccess: true,
    data: {
      deviceId,
      secretHash,
      pairingCode: null,
      pairingCodeExpiresAt: null,
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
    },
  })

  return NextResponse.json({ status: 'paired', deviceId, secret })
}
