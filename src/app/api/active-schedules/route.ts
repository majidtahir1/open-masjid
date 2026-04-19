/**
 * GET /api/active-schedules
 *
 * Returns a map of { [tenantId]: activeScheduleId | null } for every tenant
 * visible to the authenticated user.
 *
 *   - Tenant admins/staff see only their own tenant.
 *   - Platform owners (no tenant) see every tenant — since the list view
 *     can include schedules from all tenants, the Name cell needs per-row
 *     per-tenant active-detection to highlight the correct row.
 *
 * Not intended for public consumption — requires an authenticated admin
 * session.
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

  const tenantIds: Array<string | number> = []

  if (tenantId) {
    // Tenant-scoped user: only their own tenant.
    tenantIds.push(tenantId)
  } else {
    // Platform owner: every tenant.
    try {
      const res = await payload.find({
        collection: 'tenants',
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      for (const t of res.docs as Array<{ id: string | number }>) {
        tenantIds.push(t.id)
      }
    } catch {
      return NextResponse.json({})
    }
  }

  const map: Record<string, string | number | null> = {}
  await Promise.all(
    tenantIds.map(async (tid) => {
      const schedule = await getActiveSchedule(tid)
      map[String(tid)] = schedule?.id ?? null
    }),
  )

  return NextResponse.json(map)
}
