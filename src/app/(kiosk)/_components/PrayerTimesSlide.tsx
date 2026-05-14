'use client'

import React, { useState, useEffect, useMemo } from 'react'
import IslamicContentDisplay from './IslamicContentDisplay'

interface PrayerEntry {
  name: string
  adhan: string
  iqamah?: string
}

interface PrayerTimesSlideProps {
  prayerTimes?: any
  tenantName?: string
}

const PrayerTimesSlide: React.FC<PrayerTimesSlideProps> = ({ prayerTimes, tenantName }) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  // Find today's prayer times from the prayerTimes payload shape
  const todayData = useMemo(() => {
    if (!prayerTimes) return null
    const days = prayerTimes.days ?? []
    return (
      days.find((d: any) => {
        const dDate = new Date(d.date)
        return (
          dDate.getFullYear() === currentTime.getFullYear() &&
          dDate.getMonth() === currentTime.getMonth() &&
          dDate.getDate() === currentTime.getDate()
        )
      }) ?? null
    )
  }, [prayerTimes, currentTime])

  const prayerEntries: PrayerEntry[] = useMemo(() => {
    if (!todayData) return []
    const cell = (k: 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha') => ({
      adhan: todayData[k]?.adhan,
      iqamah: todayData[k]?.iqamah,
    })
    return [
      { name: 'Fajr',    ...cell('fajr') },
      { name: 'Dhuhr',   ...cell('zuhr') },
      { name: 'Asr',     ...cell('asr') },
      { name: 'Maghrib', ...cell('maghrib') },
      { name: 'Isha',    ...cell('isha') },
    ]
  }, [todayData])

  const formatTime = (raw: string | undefined): string => {
    if (!raw) return '—'
    const m = /(\d{1,2}):(\d{2})\s*([ap]m)?/i.exec(raw)
    if (!m) return raw
    let h = Number(m[1])
    const minutes = m[2]
    const explicit = m[3]?.toLowerCase() // 'am' | 'pm' | undefined
    let ampm: 'am' | 'pm'
    if (explicit) {
      ampm = explicit as 'am' | 'pm'
      if (ampm === 'pm' && h < 12) h += 0 // keep displayed hour as-is
      if (ampm === 'am' && h === 12) h = 12
    } else {
      // 24-hour input
      ampm = h >= 12 ? 'pm' : 'am'
      h = h % 12 || 12
    }
    return `${h}:${minutes} ${ampm}`
  }

  // Find next prayer
  const toMinutes = (raw: string | undefined): number | null => {
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

  const nextPrayer = useMemo(() => {
    if (!prayerEntries.length) return null
    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
    for (const entry of prayerEntries) {
      const entryMinutes = toMinutes(entry.adhan)
      if (entryMinutes === null) continue
      if (entryMinutes > nowMinutes) return entry.name
    }
    return prayerEntries[0]?.name ?? null
  }, [prayerEntries, currentTime])

  const hasAnyTime = prayerEntries.some((p) => p.adhan || p.iqamah)
  if (!prayerTimes || !hasAnyTime) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-secondary mx-auto mb-4" />
          <p className="text-tv-base">Loading Prayer Times...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-slate-900 flex flex-col relative">
      {/* Top 70% - Islamic Content Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <IslamicContentDisplay />
      </div>

      {/* Bottom 30% - Large Prayer Times */}
      <div className="h-[30%] bg-slate-800 border-t-4 border-secondary">
        <div className="h-full flex items-center justify-between px-6">
          {/* Prayer Times Grid */}
          <div className="flex-1 flex justify-between items-center gap-3">
            {prayerEntries.map((prayer) => {
              const isNext = prayer.name === nextPrayer
              return (
                <div
                  key={prayer.name}
                  className={`text-center flex-1 px-3 py-3 rounded-xl transition-all ${
                    isNext
                      ? 'bg-secondary/20 text-secondary border-2 border-secondary'
                      : 'text-white bg-slate-700'
                  }`}
                >
                  <div className="text-tv-md font-sans font-semibold mb-1">
                    {prayer.name}
                  </div>
                  {prayer.adhan && (
                    <div className="text-tv-xs font-sans opacity-75 mb-0.5">
                      Adhan: {formatTime(prayer.adhan)}
                    </div>
                  )}
                  <div className="text-tv-lg font-sans font-bold">
                    {formatTime(prayer.iqamah ?? prayer.adhan)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Next Prayer Countdown / Tenant Name */}
          {tenantName && (
            <div className="text-center ml-4 bg-black/40 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg min-w-[160px]">
              <div className="text-tv-base text-white font-semibold mb-1">Next Prayer</div>
              <div className="text-tv-lg font-bold text-secondary drop-shadow-lg">
                {nextPrayer ?? '—'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PrayerTimesSlide
