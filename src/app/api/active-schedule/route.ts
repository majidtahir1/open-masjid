/**
 * GET /api/active-schedule
 *
 * Returns the currently-active prayer schedule for the authenticated admin
 * user's tenant. Used by the ActiveScheduleBanner component to show whether
 * the schedule being edited is the one currently displayed publicly.
 *
 * Not intended for public consumption — requires an authenticated admin
 * session. Falls back cleanly if there is no tenant or no active schedule.
 */

import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { headers as nextHeaders } from 'next/headers'

import config from '@payload-config'
import { getActiveSchedule } from '@/lib/prayer-schedule'

export async function GET() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const tenantRef = (user as { tenant?: unknown }).tenant
  const tenantId =
    typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
      ? (tenantRef as { id: string | number }).id
      : (tenantRef as string | number | undefined)

  if (!tenantId) {
    return NextResponse.json({ error: 'no tenant' }, { status: 400 })
  }

  const schedule = await getActiveSchedule(tenantId)
  if (!schedule) {
    return NextResponse.json({ activeId: null, activeName: null })
  }

  return NextResponse.json({
    activeId: schedule.id,
    activeName: schedule.name ?? null,
  })
}
