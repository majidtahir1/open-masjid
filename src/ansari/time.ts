// src/ansari/time.ts
// Tenant-local time math via Intl — no date library, mirrors src/lib/adhan.ts / hijri.ts.
//
// Timezone contract
// -----------------
// All exported functions accept an IANA timezone string.  Every function
// EXCEPT `hijriParts` will throw a RangeError when given an invalid timezone
// (propagated from Intl.DateTimeFormat).  `hijriParts` mirrors the behaviour of
// src/lib/hijri.ts: it silently falls back to the system timezone on an invalid
// value.  Callers that resolve a tenant timezone must validate / fallback before
// calling (the nudge-engine pipeline does this).

const DAY_MS = 86_400_000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type LocalParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
  weekday: number // 0=Sunday … 6=Saturday
}

/**
 * Returns a new Date offset by `days` exact 24-hour multiples (instant arithmetic).
 *
 * Near a DST transition the resulting LOCAL date can skip or repeat; callers
 * iterating local days rely on hourly re-polling to self-correct.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === '24' ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  }
}

export function localDateISO(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Minutes east of UTC at `date` in `timeZone` (Chicago summer = -300). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === '24' ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return Math.round((asUTC - date.getTime()) / 60_000)
}

/** Hijri (islamic-umalqura) parts for `date` as seen in `timeZone`. Ramadan = month 9. */
export function hijriParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const make = (tz: string | undefined) =>
    new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
  let formatted
  try {
    formatted = make(timeZone).formatToParts(date)
  } catch {
    formatted = make(undefined).formatToParts(date)
  }
  const parts: Record<string, string> = {}
  for (const p of formatted) parts[p.type] = p.value
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) }
}

/** ISO-8601 week key of the tenant-local date, e.g. '2026-W24'. */
export function isoWeekKey(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' of the last day of the month AFTER the one containing `date` (tenant-local). */
export function endOfNextMonthISO(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  const last = new Date(Date.UTC(p.year, p.month + 1, 0)) // day 0 of month+2 = last of month+1
  return last.toISOString().slice(0, 10)
}
