import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { bearerFrom, verifyKioskToken } from '@/lib/checkin/kiosk'
import { loadProgramContext, applyCheck } from '@/lib/checkin/data'

export const runtime = 'nodejs'

/**
 * POST — check a child in or out. Building-level: stamps every class of the
 * bound program that meets today. Auth: kiosk bearer token from /api/checkin/bind.
 * Body: { studentId, action: 'in' | 'out' }.
 */
export async function POST(req: Request) {
  const claims = verifyKioskToken(bearerFrom(req))
  if (!claims) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { studentId?: string; action?: 'in' | 'out' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }
  const { studentId, action } = body
  if (!studentId || (action !== 'in' && action !== 'out')) {
    return NextResponse.json({ error: 'bad-fields' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  if (!payload) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  // Confirm the student belongs to this tenant before writing.
  const student = await payload
    .findByID({ collection: 'students', id: studentId, overrideAccess: true })
    .catch(() => null)
  if (!student || String((student as any).tenant) !== String(claims.tenantId)) {
    return NextResponse.json({ error: 'unknown-student' }, { status: 404 })
  }

  const ctx = await loadProgramContext(payload, claims.tenantId, claims.programId)
  if (!ctx) return NextResponse.json({ error: 'program-gone' }, { status: 410 })

  const result = await applyCheck(payload, claims.tenantId, ctx, String(studentId), action)
  return NextResponse.json({ ok: true, ...result })
}
