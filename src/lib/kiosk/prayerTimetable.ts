export type PrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha'

export interface Cell { adhan?: string; iqamah?: string }
// Carries the five fard prayers plus the informational `sunrise` time the
// schedule generator emits (see generateDays.ts → GeneratedDay.sunrise).
export type DayData = Record<PrayerKey, Cell | undefined> & { sunrise?: string }

export interface TimetableEntry {
  key: PrayerKey
  en: string
  ar: string
  adhan?: string
  iqamah?: string
}

export interface ClockTime { hm: string; ampm: 'am' | 'pm' }

export interface DaybreakRow {
  en: string
  time: ClockTime
}

/**
 * Minutes after sunrise that ishrāq (ḍuḥā) begins — the makrūh interval while
 * the sun is still rising. 15 min is the common conservative value; lifted to a
 * constant so a masjid-specific override is a one-line change.
 */
export const ISHRAQ_OFFSET_MIN = 15

const META: { key: PrayerKey; en: string; ar: string }[] = [
  { key: 'fajr', en: 'Fajr', ar: 'ٱلْفَجْر' },
  { key: 'zuhr', en: 'Dhuhr', ar: 'ٱلظُّهْر' },
  { key: 'asr', en: 'Asr', ar: 'ٱلْعَصْر' },
  { key: 'maghrib', en: 'Maghrib', ar: 'ٱلْمَغْرِب' },
  { key: 'isha', en: 'Isha', ar: 'ٱلْعِشَاء' },
]

export function parseTimeToMinutes(raw: string | undefined): number | null {
  if (!raw) return null
  const m = /(\d{1,2}):(\d{2})\s*([ap]m)?/i.exec(raw)
  if (!m) return null
  let h = Number(m[1])
  const minutes = Number(m[2])
  const ampm = m[3]?.toLowerCase()
  if (ampm === 'pm' && h !== 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  return h * 60 + minutes
}

/** Minutes-since-midnight → a display clock (12-hour, lowercase meridiem). */
export function formatClock(min: number): ClockTime {
  const ampm: 'am' | 'pm' = min % (24 * 60) >= 12 * 60 ? 'pm' : 'am'
  const h = Math.floor(min / 60) % 24
  const hour12 = h % 12 || 12
  const mm = String(min % 60).padStart(2, '0')
  return { hm: `${hour12}:${mm}`, ampm }
}

/**
 * The "daybreak" inset wedged between Fajr and Dhuhr: sunrise (shurūq) and the
 * ishrāq time derived from it. Returns null when no valid sunrise is available
 * so callers can omit the inset entirely.
 */
export function buildDaybreak(day: DayData): DaybreakRow[] | null {
  const sunriseMin = parseTimeToMinutes(day.sunrise)
  if (sunriseMin === null) return null
  return [
    { en: 'Sunrise', time: formatClock(sunriseMin) },
    { en: 'Ishrāq', time: formatClock(sunriseMin + ISHRAQ_OFFSET_MIN) },
  ]
}

export function buildTimetable(args: {
  day: DayData
  now: Date
  isFriday: boolean
  jummahTimes: string[]
}): { entries: TimetableEntry[]; nextKey: PrayerKey | null; daybreak: DaybreakRow[] | null } {
  const { day, now, isFriday, jummahTimes } = args

  const entries: TimetableEntry[] = META.map((meta) => {
    const cell = day[meta.key]
    let iqamah = cell?.iqamah
    if (meta.key === 'zuhr' && isFriday && jummahTimes.length > 0) {
      iqamah = jummahTimes[0]
    }
    return { key: meta.key, en: meta.en, ar: meta.ar, adhan: cell?.adhan, iqamah }
  })

  const nowMin = now.getHours() * 60 + now.getMinutes()
  let nextKey: PrayerKey | null = null
  for (const e of entries) {
    const min = parseTimeToMinutes(e.adhan)
    if (min !== null && min > nowMin) {
      nextKey = e.key
      break
    }
  }
  if (nextKey === null && entries.length > 0) nextKey = entries[0].key
  return { entries, nextKey, daybreak: buildDaybreak(day) }
}
