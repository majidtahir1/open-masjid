/**
 * ScheduleListBanner
 *
 * Rendered above the PrayerSchedules list view via
 * `admin.components.beforeListTable`. Renders one of:
 *
 *   - Green callout naming the currently-active schedule (the one whose
 *     startDate is the most recent date <= today), so staff immediately know
 *     which record is driving the public site.
 *   - Amber warning when no schedule has a past startDate yet — the public
 *     site is showing "Prayer times coming soon" and staff likely need to
 *     either backdate an existing schedule or create a new one.
 *
 * This is a React Server Component: the active schedule is resolved on the
 * server at render time, so the banner is present in the initial HTML and
 * does not depend on any client-side fetch / hydration path.
 */

import { getAdminUser } from '@/lib/admin-context'
import { getActiveSchedule } from '@/lib/prayer-schedule'

export default async function ScheduleListBanner() {
  try {
    const { user } = await getAdminUser()
    if (!user) return null

    const tenantRef = (user as { tenant?: unknown }).tenant
    const tenantId =
      typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
        ? (tenantRef as { id: string | number }).id
        : (tenantRef as string | number | undefined)

    // Platform owners (no tenant) see schedules across every tenant, so there
    // isn't a single "active schedule" to name here. Show a generic banner
    // pointing at the per-row "ACTIVE NOW" highlight instead.
    if (!tenantId) {
      return (
        <div
          role="status"
          style={{
            margin: '0 0 20px 0',
            padding: '16px 20px',
            borderRadius: 10,
            background: '#e0e7ff',
            borderLeft: '5px solid #4f46e5',
            color: '#312e81',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          Platform-wide view — the active schedule for each tenant is
          highlighted below.
        </div>
      )
    }

    const schedule = await getActiveSchedule(tenantId)

    if (!schedule?.name) {
      return (
        <div
          role="status"
          style={{
            margin: '0 0 20px 0',
            padding: '16px 20px',
            borderRadius: 10,
            background: '#fef3c7',
            borderLeft: '5px solid #d97706',
            color: '#78350f',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          <span aria-hidden="true">⚠ </span>
          No active prayer schedule for today. Create one with a past start
          date to activate, or set an existing schedule&rsquo;s start date to a
          date on or before today.
        </div>
      )
    }

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
