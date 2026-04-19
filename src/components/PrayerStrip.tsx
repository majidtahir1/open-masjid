import Link from 'next/link'

import type { PrayerScheduleLike, PrayerTimePair } from './types'

export interface PrayerStripProps {
  schedule: PrayerScheduleLike | null | undefined
  /** Whether to show the "Full schedule →" link. Default true. */
  showFullScheduleLink?: boolean
}

type PrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha'

interface PrayerRow {
  key: PrayerKey
  name: string
  /**
   * The masjid's iqamah (prayer start) time — what we display on the strip.
   * Falls back to adhan only if iqamah is not configured for a prayer
   * (e.g. a Maghrib entry marked "at sunset" lives in adhan).
   */
  time: string | null
}

const PRAYER_ORDER: Array<{ key: PrayerKey; name: string }> = [
  { key: 'fajr', name: 'Fajr' },
  { key: 'zuhr', name: 'Zuhr' },
  { key: 'asr', name: 'Asr' },
  { key: 'maghrib', name: 'Maghrib' },
  { key: 'isha', name: 'Isha' },
]

/**
 * Parse a time string like "5:45", "5:45 AM", "13:30" to minutes since midnight.
 * Returns null when unparseable. Treats bare times like "5:45" as AM for Fajr
 * and PM for other prayers per masjid schedule conventions.
 */
function parseTimeToMinutes(raw: string, key: PrayerKey): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i)
  if (!ampmMatch) return null
  let hour = Number(ampmMatch[1])
  const minute = Number(ampmMatch[2])
  const suffix = ampmMatch[3]?.toLowerCase()
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  if (suffix === 'am') {
    if (hour === 12) hour = 0
  } else if (suffix === 'pm') {
    if (hour < 12) hour += 12
  } else if (hour <= 12) {
    // No suffix — convention: Fajr is AM, everything else is PM.
    if (key !== 'fajr' && hour !== 12) hour += 12
  }
  return hour * 60 + minute
}

function pickTime(schedule: PrayerScheduleLike, key: PrayerKey): string | null {
  const pair = schedule[key] as PrayerTimePair | null | undefined
  if (!pair) return null
  // Public site shows iqamah (masjid-determined prayer start). Fall back to
  // adhan only when iqamah is blank — e.g. "at sunset" style Maghrib entries.
  return pair.iqamah?.trim() || pair.adhan?.trim() || null
}

/**
 * Given today's prayer times, find the index of the next upcoming prayer
 * (i.e. the soonest prayer whose time is later than now). Falls back to -1
 * when nothing is in the future (end of the day / no data).
 */
function findNextPrayer(rows: PrayerRow[], now: Date): number {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row.time) continue
    const mins = parseTimeToMinutes(row.time, row.key)
    if (mins === null) continue
    if (mins >= nowMinutes) return i
  }
  return -1
}

function formatJummahTimes(
  raw: PrayerScheduleLike['jummahTimes'] | undefined,
): string[] {
  if (!raw) return []
  return raw
    .map((t) => (typeof t === 'string' ? t : t?.time))
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
}

export default function PrayerStrip({
  schedule,
  showFullScheduleLink = true,
}: PrayerStripProps) {
  // No data — render a subtle placeholder strip.
  if (!schedule) {
    return (
      <div className="bg-brand-ink text-white">
        <div className="mx-auto flex min-h-12 max-w-page items-center justify-between gap-6 px-6 py-[14px]">
          <span className="text-fs-sm text-white/70">
            Prayer times coming soon
          </span>
          {showFullScheduleLink && (
            <Link
              href="/prayer-times"
              className="text-fs-sm font-medium text-teal-200 hover:text-white"
            >
              Full schedule →
            </Link>
          )}
        </div>
      </div>
    )
  }

  const rows: PrayerRow[] = PRAYER_ORDER.map(({ key, name }) => ({
    key,
    name,
    time: pickTime(schedule, key),
  }))

  const nextIdx = findNextPrayer(rows, new Date())
  const jummahTimes = formatJummahTimes(schedule.jummahTimes)

  return (
    <div className="bg-brand-ink text-white">
      <div className="mx-auto flex min-h-12 max-w-page flex-wrap items-center gap-6 px-6 py-[14px]">
        <div className="flex flex-1 flex-wrap gap-7">
          {rows.map((row, i) => {
            const isNext = i === nextIdx
            return (
              <div key={row.key} className="flex flex-col gap-[2px]">
                <span
                  className={[
                    'text-[10.5px] uppercase tracking-caps',
                    isNext ? 'text-gold-300' : 'text-white/60',
                  ].join(' ')}
                >
                  {isNext ? `${row.name} •` : row.name}
                </span>
                <span
                  className={[
                    'font-mono text-[15px] font-semibold',
                    isNext ? 'text-gold-300' : 'text-white',
                  ].join(' ')}
                >
                  {row.time ?? '—'}
                </span>
              </div>
            )
          })}

          {jummahTimes.length > 0 && (
            <div className="flex flex-col gap-[2px] border-l border-white/15 pl-[18px]">
              <span className="text-[10.5px] uppercase tracking-caps text-white/60">
                Jummah · {jummahTimes.length} khutba
                {jummahTimes.length > 1 ? 's' : ''}
              </span>
              <span className="flex flex-wrap items-baseline gap-[10px]">
                {jummahTimes.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-baseline gap-1 font-mono text-[14px] font-semibold text-white"
                  >
                    <span className="inline-flex items-center rounded-[3px] bg-[rgba(184,149,79,0.18)] px-[5px] py-[2px] font-body text-[9.5px] font-semibold text-gold-300">
                      {i + 1}
                    </span>
                    {t}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>

        {showFullScheduleLink && (
          <Link
            href="/prayer-times"
            className="flex-shrink-0 text-fs-sm font-medium text-teal-200 transition-colors duration-fast hover:text-white"
          >
            Full schedule →
          </Link>
        )}
      </div>
    </div>
  )
}
