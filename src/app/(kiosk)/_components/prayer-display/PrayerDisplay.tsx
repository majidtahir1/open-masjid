'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { PrayerVariant } from '@/lib/kiosk/prayerDisplaySelection'
import type { ContentEntry } from '@/lib/kiosk/prayerContentSeeds'
import { buildTimetable, parseTimeToMinutes, type DayData } from '@/lib/kiosk/prayerTimetable'
import { formatHijri } from '@/lib/hijri'

const EYEBROW: Record<ContentEntry['kind'], string | null> = {
  ayah: 'Ayah of the day',
  hadith: 'Hadith',
  dua: "Du'a",
  bismillah: null,
}

function fmtClock(d: Date) {
  let h = d.getHours()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return { hm: `${h}:${m}`, ampm }
}

export interface PrayerDisplayProps {
  variant: PrayerVariant
  content: ContentEntry | null
  day: DayData | null
  venueName: string
  displayCity: string | null
  timezone: string
}

export default function PrayerDisplay({
  variant, content, day, venueName, displayCity, timezone,
}: PrayerDisplayProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const isFriday = now.getDay() === 5
  const timetable = useMemo(
    () => (day ? buildTimetable({ day, now, isFriday, jummahTimes: [] }) : { entries: [], nextKey: null }),
    [day, now, isFriday],
  )

  const clock = fmtClock(now)
  const hijri = formatHijri(now, timezone)
  const greg = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone,
  }).format(now)

  const eyebrow = content ? EYEBROW[content.kind] : null

  return (
    <div className={`pd-screen pd-${variant}`}>
      <div className="pd-topbar">
        <div className="pd-tb-venue">
          <div className="pd-tb-name">{venueName}</div>
          {displayCity && <div className="pd-tb-city">{displayCity}</div>}
        </div>
        <div className="pd-tb-right">
          <div className="pd-tb-clock">{clock.hm}<sup>{clock.ampm}</sup></div>
          <div className="pd-tb-dates">
            {hijri}
            <span className="pd-dot" />
            {greg}
          </div>
        </div>
      </div>

      <div className="pd-hero">
        {eyebrow && <div className="pd-verse-eyebrow">{eyebrow}</div>}
        {content && (
          <>
            <div className="pd-hero-arabic" dir="rtl">{content.arabic}</div>
            <div className="pd-hero-english">{content.english}</div>
            {content.citation && <div className="pd-hero-cite">{content.citation}</div>}
          </>
        )}
      </div>

      <div className="pd-timetable">
        {timetable.entries.map((p) => {
          const isNext = p.key === timetable.nextKey
          const adhanMin = parseTimeToMinutes(p.adhan)
          const ampm = adhanMin !== null && adhanMin >= 12 * 60 ? 'pm' : 'am'
          const adhanHM = p.adhan ? p.adhan.replace(/\s*[ap]m$/i, '') : '—'
          return (
            <div key={p.key} className={`pd-prayer${isNext ? ' is-next' : ''}`}>
              {isNext && <div className="pd-next-tag">Next</div>}
              <div className="pd-prayer-ar">{p.ar}</div>
              <div className="pd-prayer-name">{p.en}</div>
              <div className="pd-prayer-adhan">{adhanHM}<sup>{ampm}</sup></div>
              <div className="pd-prayer-iqamah">Iqamah · {p.iqamah ? p.iqamah.replace(/\s*[AP]M$/i, '') : '—'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
