import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const cronSecret = process.env.KIOSK_CRON_SECRET
  if (cronSecret) {
    const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const payload = await getPayloadClient()
  if (!payload) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  const threshold = new Date(Date.now() - 3 * 60 * 1000).toISOString()

  const { docs } = await payload.find({
    collection: 'kiosks',
    where: {
      and: [
        { status: { equals: 'ONLINE' } },
        { lastSeenAt: { less_than: threshold } },
      ],
    },
    limit: 200,
    overrideAccess: true,
  })

  for (const k of docs) {
    await payload.update({
      collection: 'kiosks',
      id: k.id,
      data: { status: 'OFFLINE' },
      overrideAccess: true,
    })
  }

  return NextResponse.json({ flipped: docs.length })
}
