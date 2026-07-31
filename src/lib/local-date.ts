/**
 * Calendar-date helpers for date-only fields.
 *
 * Schedule `startDate`/`endDate` and `days[].date` are date-only values stored
 * at midnight UTC (e.g. `2026-07-31T00:00:00.000Z` means "July 31"). Treating
 * them as instants breaks near day boundaries: for a US tenant, "now" passes a
 * schedule's midnight-UTC endDate at 7pm the evening BEFORE its last day.
 *
 * Always resolve "today" as a calendar date in the tenant's timezone, then
 * compare calendar dates.
 *
 * Pure and client-safe — no server-only imports.
 */

/** The calendar date (`YYYY-MM-DD`) of `date` in `timeZone` (UTC if omitted). */
export function localDateKey(date: Date, timeZone?: string): string {
  if (!timeZone) return date.toISOString().slice(0, 10)
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * Midnight UTC of the local calendar date — the representation date-only
 * fields are stored in, suitable for `<=` / `>=` comparisons against them.
 */
export function localDayFloorISO(date: Date, timeZone?: string): string {
  return `${localDateKey(date, timeZone)}T00:00:00.000Z`
}
