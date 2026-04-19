/**
 * Prayer schedule resolver.
 *
 * The "active" schedule at any moment is determined purely by date:
 *   - Find all schedules for the tenant with `startDate <= date`, sorted desc.
 *   - Return the one with the most recent startDate.
 *   - If none exist (i.e. no schedule has a past start date), return null.
 *     The public site is expected to render a "Prayer times coming soon"
 *     placeholder in that case.
 *
 * All lookups use `overrideAccess: true` since the public site is read-only.
 */

import { unstable_noStore as noStore } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { TenantRecord } from './tenant-parse'

async function payloadClient() {
  return getPayload({ config })
}

export interface PrayerScheduleRecord {
  id: string | number
  name?: string | null
  startDate?: string | null
  fajr?: { adhan?: string | null; iqamah?: string | null } | null
  zuhr?: { adhan?: string | null; iqamah?: string | null } | null
  asr?: { adhan?: string | null; iqamah?: string | null } | null
  maghrib?: { adhan?: string | null; iqamah?: string | null } | null
  isha?: { adhan?: string | null; iqamah?: string | null } | null
  jummahTimes?: Array<{ time?: string | null } | string> | null
  notes?: string | null
}

/**
 * Return the schedule that should be shown as the active schedule for
 * `tenantId` on `date` — i.e. the one whose `startDate` is the most recent
 * date that is still `<= date`. If no schedule has yet started, return null.
 */
export async function getActiveSchedule(
  tenantId: string | number,
  date: Date = new Date(),
): Promise<PrayerScheduleRecord | null> {
  noStore()
  const payload = await payloadClient()
  const iso = date.toISOString()

  try {
    const dated = await payload.find({
      collection: 'prayer-schedules',
      where: {
        tenant: { equals: tenantId },
        startDate: { less_than_equal: iso },
      },
      sort: '-startDate',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (dated.docs[0]) return dated.docs[0] as PrayerScheduleRecord
  } catch {
    return null
  }

  return null
}

/**
 * Return all schedules for a tenant, sorted by startDate descending
 * (newest first). Schedules without a startDate (legacy / dateless) are
 * placed at the end.
 *
 * Used by the Prayer Times page to show a "Schedule changes" timeline.
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
