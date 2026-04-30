import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GRACE_DAYS = 30

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  const expected = process.env.BILLING_SWEEP_TOKEN
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const payload = await getPayload({ config })
  const now = new Date()
  const nowIso = now.toISOString()

  const trialExpired = await payload.find({
    collection: 'tenants',
    where: {
      and: [
        { status: { equals: 'trialing' } },
        { trialEndsAt: { less_than: nowIso } },
        { gracePeriodEndsAt: { equals: null } },
      ],
    },
    limit: 1000,
    overrideAccess: true,
  })
  const graceEnd = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  for (const t of trialExpired.docs) {
    await payload.update({
      collection: 'tenants',
      id: (t as { id: string | number }).id,
      data: { gracePeriodEndsAt: graceEnd },
      overrideAccess: true,
    })
  }

  const graceExpired = await payload.find({
    collection: 'tenants',
    where: {
      and: [
        { status: { equals: 'canceled' } },
        { gracePeriodEndsAt: { less_than: nowIso } },
      ],
    },
    limit: 1000,
    overrideAccess: true,
  })
  for (const t of graceExpired.docs) {
    await payload.update({
      collection: 'tenants',
      id: (t as { id: string | number }).id,
      data: { status: 'offline' },
      overrideAccess: true,
    })
  }

  return NextResponse.json({
    trialMovedToGrace: trialExpired.docs.length,
    movedToOffline: graceExpired.docs.length,
  })
}
