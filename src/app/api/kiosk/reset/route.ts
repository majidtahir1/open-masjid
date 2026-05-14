import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const kioskId = typeof body?.kioskId === 'string' ? body.kioskId : null
  if (!kioskId) return NextResponse.json({ error: 'kioskId-required' }, { status: 400 })

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
  })

  return NextResponse.json({ ok: true })
}
