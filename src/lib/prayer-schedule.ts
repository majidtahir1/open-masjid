/**
 * Prayer schedule resolver.
 *
 * The "active" schedule at any moment is determined by date:
 *   1. Find all schedules for the tenant with `startDate <= date`, sorted desc.
 *   2. If any exist, return the most recent one.
 *   3. Otherwise, fall back to the schedule marked `isCurrent: true`.
 *   4. If neither exists, return null.
 *
 * All lookups use `overrideAccess: true` since the public site is read-only.
 */

import { getPayload } from 'payload'
import config from '@payload-config'

import type { TenantRecord } from './tenant-parse'

async function payloadClient() {
  return getPayload({ config })
}

export interface PrayerScheduleRecord {
  id: string | number
  name?: string | null
  isCurrent?: boolean | null
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
 * `tenantId` on `date`. See module docstring for the resolution order.
 */
export async function getActiveSchedule(
  tenantId: string | number,
  date: Date = new Date(),
): Promise<PrayerScheduleRecord | null> {
  const payload = await payloadClient()
  const iso = date.toISOString()

  try {
    // 1. Most recent dated schedule that has already started.
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
    // fall through to baseline
  }

  try {
    // 2. Baseline "Current" schedule.
    const baseline = await payload.find({
      collection: 'prayer-schedules',
      where: {
        tenant: { equals: tenantId },
        isCurrent: { equals: true },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (baseline.docs[0]) return baseline.docs[0] as PrayerScheduleRecord
  } catch {
    return null
  }

  return null
}

/**
 * Return all schedules for a tenant, sorted with dated schedules first
 * (newest startDate → oldest) and the baseline (isCurrent) last.
 *
 * Used by the Prayer Times page to show a "Schedule changes" timeline.
 */
export async function getAllSchedules(
  tenant: TenantRecord,
): Promise<PrayerScheduleRecord[]> {
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
    // Put baseline (no startDate / isCurrent) at the very end.
    return [...docs].sort((a, b) => {
      const aBaseline = !a.startDate || a.isCurrent
      const bBaseline = !b.startDate || b.isCurrent
      if (aBaseline && !bBaseline) return 1
      if (!aBaseline && bBaseline) return -1
      // Both baseline or both dated — keep existing order (startDate desc).
      if (!a.startDate) return 0
      if (!b.startDate) return 0
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })
  } catch {
    return []
  }
}
