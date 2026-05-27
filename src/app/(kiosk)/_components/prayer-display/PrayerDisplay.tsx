'use client'

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PrayerVariant } from '@/lib/kiosk/prayerDisplaySelection'
import type { ContentEntry } from '@/lib/kiosk/prayerContentSeeds'
import { buildTimetable, parseTimeToMinutes, type DayData } from '@/lib/kiosk/prayerTimetable'
import { formatHijri } from '@/lib/hijri'
import PrayerStage from './PrayerStage'

const EYEBROW: Record<ContentEntry['kind'], string | null> = {
  ayah: 'Ayah of the day',
  hadith: 'Hadith',
  dua: "Du'a",
  bismillah: null,
}

// Max height (in 1920x1080 design px) the hero may occupy before it would
// collide with the bottom timetable, per variant. The hero starts at y=0 in
// flow (the topbar is absolutely positioned), so this equals the timetable's
// top edge minus a small margin.
const HERO_BUDGET: Record<PrayerVariant, number> = {
  cream: 700, // timetable height 360 → top at 720
  night: 740, // timetable height 320 → top at 760
  mihrab: 700, // keep the hadith within the arch motif
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
  jummahTimes: string[]
}

export default function PrayerDisplay({
  variant, content, day, venueName, displayCity, timezone, jummahTimes,
}: PrayerDisplayProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const isFriday = now.getDay() === 5
  const timetable = useMemo(
    () => (day ? buildTimetable({ day, now, isFriday, jummahTimes }) : { entries: [], nextKey: null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, now, isFriday, jummahTimes],
  )

  const clock = fmtClock(now)
  const hijri = formatHijri(now, timezone)
  const greg = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone,
  }).format(now)

  const eyebrow = content ? EYEBROW[content.kind] : null

  // Auto-fit the Arabic hero text so any content length fits the available
  // band without overflowing into the timetable. A short Bismillah stays
  // large and dramatic; a long ayah shrinks to fit. Runs before paint.
  const heroRef = useRef<HTMLDivElement>(null)
  const arabicRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const hero = heroRef.current
    const ar = arabicRef.current
    if (!hero || !ar) return
    const budget = HERO_BUDGET[variant]
    hero.style.maxHeight = `${budget}px`
    hero.style.overflow = 'hidden'
    let lo = 34
    let hi = 150
    let best = 34
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      ar.style.fontSize = `${mid}px`
      if (hero.offsetHeight <= budget) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    ar.style.fontSize = `${best}px`
  }, [content, variant])

  return (
    <PrayerStage>
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

      <div className="pd-hero" ref={heroRef}>
        {eyebrow && <div className="pd-verse-eyebrow">{eyebrow}</div>}
        {content && (
          <>
            <div className="pd-hero-arabic" dir="rtl" ref={arabicRef}>{content.arabic}</div>
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
    </PrayerStage>
  )
}
