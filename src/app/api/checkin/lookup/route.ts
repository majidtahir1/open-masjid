import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { bearerFrom, verifyKioskToken } from '@/lib/checkin/kiosk'
import { loadProgramContext, findFamily } from '@/lib/checkin/data'

export const runtime = 'nodejs'

/**
 * POST — look up a family's children by guardian phone number.
 * Auth: a tenant+program-scoped kiosk bearer token from /api/checkin/bind.
 */
export async function POST(req: Request) {
  const claims = verifyKioskToken(bearerFrom(req))
  if (!claims) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { phone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }
  if (!body.phone) return NextResponse.json({ error: 'missing-phone' }, { status: 400 })

  const payload = await getPayloadClient()
  if (!payload) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const ctx = await loadProgramContext(payload, claims.tenantId, claims.programId)
  if (!ctx) return NextResponse.json({ error: 'program-gone' }, { status: 410 })

  const family = await findFamily(payload, claims.tenantId, ctx, body.phone)
  if (!family.children.length) {
    return NextResponse.json({ found: false, programName: ctx.programName })
  }

  return NextResponse.json({
    found: true,
    programName: ctx.programName,
    familyName: family.familyName,
    children: family.children,
  })
}
