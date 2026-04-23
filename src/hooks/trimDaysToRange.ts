import type { CollectionBeforeChangeHook } from 'payload'

type DayRow = { date?: string | null; [k: string]: unknown }

/**
 * When a PrayerSchedule is saved with startDate/endDate set, drop any `days[]`
 * entries whose date falls outside the range. This keeps the stored data in
 * sync with the admin's stated intent — admins who narrow the range without
 * re-running "Generate times" no longer see stale day rows from the old
 * (wider) range.
 *
 * Trim only: we never add missing days here — that's the "Generate times"
 * button's job, which runs the adhan calculation.
 */
export const trimDaysToRange: CollectionBeforeChangeHook = ({ data }) => {
  const startISO = data?.startDate as string | null | undefined
  const endISO = data?.endDate as string | null | undefined
  const days = (data?.days as DayRow[] | null | undefined) ?? null

  if (!startISO || !endISO || !Array.isArray(days) || days.length === 0) return data

  const startDay = startISO.slice(0, 10)
  const endDay = endISO.slice(0, 10)

  data.days = days.filter((d) => {
    if (!d?.date) return false
    const day = d.date.slice(0, 10)
    return day >= startDay && day <= endDay
  })

  return data
}
