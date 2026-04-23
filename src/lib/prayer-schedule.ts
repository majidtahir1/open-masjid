/**
 * Prayer schedule resolver.
 *
 * The "active" schedule right now covers the current date:
 *   - Find all schedules for the tenant where `startDate <= date <= endDate`.
 *   - If multiple match, pick the one with the most recent startDate.
 *   - If none match, return null. The public site renders "Prayer times coming soon".
 *
 * Per-day adhan + iqamah live in `days[]` inside each schedule. Use
 * `findDayRow(schedule, date)` to get today's row.
 */

import { unstable_noStore as noStore } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { TenantRecord } from './tenant-parse'

async function payloadClient() {
  return getPayload({ config })
}

export interface PrayerDayRow {
  date?: string | null
  fajr?: { adhan?: string | null; iqamah?: string | null } | null
  zuhr?: { adhan?: string | null; iqamah?: string | null } | null
  asr?: { adhan?: string | null; iqamah?: string | null } | null
  maghrib?: { adhan?: string | null; iqamah?: string | null } | null
  isha?: { adhan?: string | null; iqamah?: string | null } | null
}

export interface PrayerScheduleRecord {
  id: string | number
  name?: string | null
  startDate?: string | null
  endDate?: string | null
  jummahTimes?: Array<{ time?: string | null } | string> | null
  notes?: string | null
  days?: PrayerDayRow[] | null
}

export async function getActiveSchedule(
  tenantId: string | number,
  date: Date = new Date(),
): Promise<PrayerScheduleRecord | null> {
  noStore()
  const payload = await payloadClient()
  const iso = date.toISOString()
  // endDate is inclusive: a schedule with endDate = Apr 30 00:00 UTC should
  // still be active at any moment on Apr 30 UTC. Compare against the UTC
  // midnight of the query date so the match is inclusive through that day.
  const dayFloorISO = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString()

  try {
    const res = await payload.find({
      collection: 'prayer-schedules',
      where: {
        tenant: { equals: tenantId },
        startDate: { less_than_equal: iso },
        endDate: { greater_than_equal: dayFloorISO },
      },
      sort: '-startDate',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return (res.docs[0] as PrayerScheduleRecord) ?? null
  } catch {
    return null
  }
}

/**
 * Find the `days[]` row whose date matches the given date (compared by YYYY-MM-DD).
 * Returns null if the schedule has no row for that date.
 */
export function findDayRow(
  schedule: PrayerScheduleRecord | null,
  date: Date = new Date(),
): PrayerDayRow | null {
  if (!schedule?.days?.length) return null
  const target = date.toISOString().slice(0, 10)
  return (
    schedule.days.find((d) => (d.date ? d.date.slice(0, 10) === target : false)) ?? null
  )
}

/**
 * Return all schedules for a tenant, sorted by startDate descending (newest first).
 */
export async function getAllSchedules(
  tenant: TenantRecord,
): Promise<PrayerScheduleRecord[]> {
  noStore()
  const payload = await payloadClient()
  try {
    const res = await payload.find({
      collection: 'prayer-schedules',
      where: { tenant: { equals: tenant.id } },
      sort: '-startDate',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    const docs = res.docs as PrayerScheduleRecord[]
    return [...docs].sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0
      if (!a.startDate) return 1
      if (!b.startDate) return -1
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })
  } catch {
    return []
  }
}
