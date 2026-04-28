/**
 * Live-data fetchers for hero variants that surface real-time info
 * (the `split` and `photo` variants show next iqamah; `live` shows a
 * widget with iqamah + upcoming events).
 *
 * Both helpers wrap their work in try/catch and return null/empty on
 * failure so that a data hiccup never blocks the homepage hero render.
 */

import { unstable_noStore as noStore } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { HeroLiveData } from '@/components/types'
import { findDayRow, getActiveSchedule } from './prayer-schedule'

type PrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha'

const PRAYER_ORDER: Array<{ key: PrayerKey; label: string }> = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'zuhr', label: 'Zuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
]

/**
 * Parse a time string like "5:45", "5:45 AM", "13:30" into minutes since
 * midnight. Returns null when unparseable. When AM/PM is omitted, treats
 * Fajr as AM and everything else as PM (masjid schedule convention).
 */
export function parseTimeToMinutes(raw: string, key: PrayerKey): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const m = trimmed.match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i)
  if (!m) return null
  let hour = Number(m[1])
  const minute = Number(m[2])
  const suffix = m[3]?.toLowerCase()
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (suffix === 'am') {
    if (hour === 12) hour = 0
  } else if (suffix === 'pm') {
    if (hour < 12) hour += 12
  } else if (hour <= 12) {
    if (key !== 'fajr' && hour !== 12) hour += 12
  }
  return hour * 60 + minute
}

function formatDisplayTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440
  const h24 = Math.floor(normalized / 60)
  const mm = normalized % 60
  const isPm = h24 >= 12
  let h12 = h24 % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${mm.toString().padStart(2, '0')} ${isPm ? 'pm' : 'am'}`
}

interface NextIqamahResult {
  name: string
  atTime: string
  secondsUntil: number
}

/**
 * Pure function exposed for testing. Given a day row and a "now" reference,
 * pick the next iqamah whose minutes value is >= now's minutes. Returns null
 * if every prayer for that day has already passed (caller can roll over to
 * the next day's Fajr separately).
 */
export function pickNextIqamahFromDay(
  day: {
    fajr?: { iqamah?: string | null } | null
    zuhr?: { iqamah?: string | null } | null
    asr?: { iqamah?: string | null } | null
    maghrib?: { iqamah?: string | null } | null
    isha?: { iqamah?: string | null } | null
  } | null,
  now: Date,
): NextIqamahResult | null {
  if (!day) return null
  const nowMins = now.getHours() * 60 + now.getMinutes()
  for (const { key, label } of PRAYER_ORDER) {
    const pair = day[key]
    const raw = pair?.iqamah?.trim()
    if (!raw) continue
    const mins = parseTimeToMinutes(raw, key)
    if (mins === null) continue
    if (mins >= nowMins) {
      const secondsUntil = (mins - nowMins) * 60 - now.getSeconds()
      return {
        name: label,
        atTime: formatDisplayTime(mins),
        secondsUntil: Math.max(0, secondsUntil),
      }
    }
  }
  return null
}

/**
 * Compute next iqamah for a tenant. After Isha, rolls over to tomorrow's
 * Fajr. Returns null if no schedule exists or no iqamahs are configured.
 */
export async function getNextIqamah(
  tenantId: string | number,
  now: Date = new Date(),
): Promise<NextIqamahResult | null> {
  try {
    const schedule = await getActiveSchedule(tenantId, now)
    if (!schedule) return null

    const today = findDayRow(schedule, now)
    const todayHit = pickNextIqamahFromDay(today, now)
    if (todayHit) return todayHit

    // Nothing left today — roll forward to tomorrow's Fajr.
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowSchedule = await getActiveSchedule(tenantId, tomorrow)
    const tomorrowDay = findDayRow(tomorrowSchedule, tomorrow)
    const fajrRaw = tomorrowDay?.fajr?.iqamah?.trim()
    if (!fajrRaw) return null
    const fajrMins = parseTimeToMinutes(fajrRaw, 'fajr')
    if (fajrMins === null) return null

    const startOfTomorrow = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      0,
      0,
      0,
      0,
    )
    const fajrAt = new Date(startOfTomorrow.getTime() + fajrMins * 60_000)
    const secondsUntil = Math.max(
      0,
      Math.floor((fajrAt.getTime() - now.getTime()) / 1000),
    )
    return {
      name: 'Fajr',
      atTime: formatDisplayTime(fajrMins),
      secondsUntil,
    }
  } catch {
    return null
  }
}

interface UpcomingEventTeaser {
  id: string | number
  title: string
  when: string
  href: string
}

/**
 * Fetch up to N upcoming published events for the "Right now" widget.
 */
export async function getUpcomingEvents(
  tenantId: string | number,
  limit = 2,
  now: Date = new Date(),
): Promise<UpcomingEventTeaser[]> {
  try {
    const payload = await getPayload({ config })
    noStore()
    const res = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenantId },
        _status: { equals: 'published' },
        startDate: { greater_than_equal: now.toISOString() },
      },
      sort: 'startDate',
      limit,
      depth: 0,
      overrideAccess: true,
    })
    return res.docs.map((doc) => {
      const ev = doc as {
        id: string | number
        title: string
        slug?: string | null
        when?: string | null
        startDate?: string | null
      }
      return {
        id: ev.id,
        title: ev.title,
        when: ev.when ?? formatEventDate(ev.startDate),
        href: ev.slug ? `/events/${ev.slug}` : '/events',
      }
    })
  } catch {
    return []
  }
}

function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

/**
 * Convenience wrapper: fetch both pieces in parallel for the home page.
 * Always returns a defined HeroLiveData object so callers can pass it
 * unconditionally.
 */
export async function getHeroLiveData(
  tenantId: string | number,
): Promise<HeroLiveData> {
  const [nextIqamah, upcomingEvents] = await Promise.all([
    getNextIqamah(tenantId),
    getUpcomingEvents(tenantId, 2),
  ])
  return { nextIqamah, upcomingEvents }
}
