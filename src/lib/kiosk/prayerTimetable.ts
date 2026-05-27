export type PrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha'

export interface Cell { adhan?: string; iqamah?: string }
export type DayData = Record<PrayerKey, Cell | undefined>

export interface TimetableEntry {
  key: PrayerKey
  en: string
  ar: string
  adhan?: string
  iqamah?: string
}

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

export function buildTimetable(args: {
  day: DayData
  now: Date
  isFriday: boolean
  jummahTimes: string[]
}): { entries: TimetableEntry[]; nextKey: PrayerKey | null } {
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
  return { entries, nextKey }
}
