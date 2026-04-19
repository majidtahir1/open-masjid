/**
 * ScheduleListBanner
 *
 * Rendered above the PrayerSchedules list view via
 * `admin.components.beforeListTable`. Shows a prominent green callout naming
 * the currently-active schedule so staff immediately know which record is
 * driving the public site.
 *
 * This is a React Server Component: the active schedule is resolved on the
 * server at render time, so the banner is present in the initial HTML and
 * does not depend on any client-side fetch / hydration path.
 */

import { getPayload } from 'payload'
import { headers as nextHeaders } from 'next/headers'

import config from '@payload-config'
import { getActiveSchedule } from '@/lib/prayer-schedule'

export default async function ScheduleListBanner() {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await nextHeaders() })
    if (!user) return null

    const tenantRef = (user as { tenant?: unknown }).tenant
    const tenantId =
      typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
        ? (tenantRef as { id: string | number }).id
        : (tenantRef as string | number | undefined)

    // Platform owners without a tenant can't have a single "active" schedule
    // surfaced here — just skip the banner in that case.
    if (!tenantId) return null

    const schedule = await getActiveSchedule(tenantId)
    if (!schedule?.name) return null

    return (
      <div
        role="status"
        style={{
          margin: '0 0 20px 0',
          padding: '16px 20px',
          borderRadius: 10,
          background: '#dcfce7',
          borderLeft: '5px solid #16a34a',
          color: '#14532d',
          fontSize: '1rem',
          fontWeight: 600,
        }}
      >
        <span aria-hidden="true">✓ </span>
        Currently active schedule: <strong>{schedule.name}</strong> — this is
        what the public site displays right now.
      </div>
    )
  } catch {
    // Banner is an enhancement — never break the list view if it fails.
    return null
  }
}
