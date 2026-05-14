'use client'

import React, { useState, useEffect, useMemo } from 'react'
import QRCodeDisplay from './QRCodeDisplay'
import { getRandomGradient } from '../_lib/constants/gradients'
import { getTheme } from '../_lib/themes/islamicThemes'

// Payload collection shape for CustomSlide
export type CustomSlideData = {
  id: string
  title: string
  details1?: string | null
  details2?: string | null
  backgroundTheme?: string | null
  prayerTimingsEnabled?: boolean | null
  qrCode?:
    | {
        generatedImage?: { url?: string } | string | null
        targetUrl?: string | null
        label?: string | null
      }
    | string
    | null
  image?: { url?: string } | string | null
}

interface CustomSlideProps {
  slide: CustomSlideData
  gradientKey?: number
  prayerTimes?: any
}

// Minimal prayer entry for display
interface PrayerEntry {
  name: string
  adhan: string
  iqamah?: string
  isNext: boolean
}

const CustomSlide: React.FC<CustomSlideProps> = ({ slide, gradientKey = 0, prayerTimes }) => {
  const [currentTime, setCurrentTime] = useState(new Date())

  // Generate a fresh random gradient whenever gradientKey changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentGradient = useMemo(() => getRandomGradient(), [gradientKey])

  // Get Islamic theme if one is set
  const theme = useMemo(() => getTheme(slide.backgroundTheme ?? null), [slide.backgroundTheme])
  const hasTheme = theme !== null && theme.id !== 'clean'

  // Timer for current time updates (only if prayer timings are enabled)
  useEffect(() => {
    if (!slide.prayerTimingsEnabled) return
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [slide.prayerTimingsEnabled])

  // Build prayer entries from passed-in prayerTimes
  const prayerEntries: PrayerEntry[] = useMemo(() => {
    if (!slide.prayerTimingsEnabled || !prayerTimes) return []
    const days = prayerTimes.days ?? []
    const today = days.find((d: any) => {
      const dDate = new Date(d.date)
      return (
        dDate.getFullYear() === currentTime.getFullYear() &&
        dDate.getMonth() === currentTime.getMonth() &&
        dDate.getDate() === currentTime.getDate()
      )
    })
    if (!today) return []

    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
    const raw = [
      { name: 'Fajr', adhan: today.fajr, iqamah: today.iqamah?.fajr },
      { name: 'Dhuhr', adhan: today.dhuhr, iqamah: today.iqamah?.dhuhr },
      { name: 'Asr', adhan: today.asr, iqamah: today.iqamah?.asr },
      { name: 'Maghrib', adhan: today.maghrib, iqamah: today.iqamah?.maghrib },
      { name: 'Isha', adhan: today.isha, iqamah: today.iqamah?.isha },
    ]

    let nextName: string | null = null
    for (const e of raw) {
      if (!e.adhan) continue
      const m = /(\d{1,2}):(\d{2})/.exec(e.adhan)
      if (!m) continue
      if (Number(m[1]) * 60 + Number(m[2]) > nowMinutes) {
        nextName = e.name
        break
      }
    }

    return raw.map((e) => ({ ...e, isNext: e.name === nextName }))
  }, [slide.prayerTimingsEnabled, prayerTimes, currentTime])

  const formatTime = (raw: string | undefined): string => {
    if (!raw) return '—'
    const m = /(\d{1,2}):(\d{2})/.exec(raw)
    if (!m) return raw
    let h = Number(m[1])
    const ampm = h >= 12 ? 'pm' : 'am'
    h = h % 12 || 12
    return `${h}:${m[2]} ${ampm}`
  }

  // Resolve QR code URL
  const qrCodeUrl = useMemo(() => {
    if (!slide.qrCode || typeof slide.qrCode === 'string') return null
    const gi = slide.qrCode.generatedImage
    if (!gi) return null
    if (typeof gi === 'string') return gi
    return gi.url ?? null
  }, [slide.qrCode])

  return (
    <div
      className="w-full h-full flex flex-col relative"
      style={{
        background: hasTheme ? theme.backgroundColor : currentGradient.css,
        transition: 'background 2s ease-in-out',
      }}
    >
      {/* Islamic Pattern Background Overlay (only if theme is set and has pattern) */}
      {hasTheme && theme.backgroundImage !== 'none' && (
        <div
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            backgroundImage: `url('${theme.backgroundImage}')`,
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: theme.backgroundOpacity,
            zIndex: 1,
          }}
        />
      )}

      {/* Main Content Area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        style={{
          paddingTop: hasTheme ? theme.safeZones.topMargin : slide.prayerTimingsEnabled ? '3rem' : '2rem',
          paddingBottom: hasTheme ? theme.safeZones.bottomMargin : slide.prayerTimingsEnabled ? '0.5rem' : '2rem',
          paddingLeft: hasTheme ? theme.safeZones.sidePadding : '1.5rem',
          paddingRight: hasTheme ? theme.safeZones.sidePadding : '1.5rem',
          zIndex: 2,
        }}
      >
        <div className="text-center max-w-[85%] w-full">
          {/* Title */}
          <h1
            className="font-bold leading-tight"
            style={{
              color: hasTheme ? theme.textColor : 'white',
              fontSize: hasTheme
                ? `clamp(${theme.typography.titleSize.min}px, ${theme.typography.titleSize.preferred}, ${theme.typography.titleSize.max}px)`
                : slide.prayerTimingsEnabled
                  ? 'clamp(2rem, 5vw, 6rem)'
                  : 'clamp(3rem, 8vw, 10rem)',
              marginBottom: slide.prayerTimingsEnabled ? '0.75rem' : '1.5rem',
              textShadow: hasTheme && theme.id === 'full-ambiance' ? '3px 3px 16px rgba(0,0,0,0.8)' : undefined,
            }}
          >
            {slide.title}
          </h1>

          {/* Details */}
          <div style={{ marginBottom: slide.prayerTimingsEnabled ? '0.75rem' : '2rem' }}>
            {slide.details1 && (
              <p
                style={{
                  color: hasTheme ? theme.subtitleColor : 'rgba(255,255,255,0.9)',
                  fontSize: hasTheme
                    ? `clamp(${theme.typography.subtitleSize.min}px, ${theme.typography.subtitleSize.preferred}, ${theme.typography.subtitleSize.max}px)`
                    : slide.prayerTimingsEnabled
                      ? 'clamp(1rem, 2.5vw, 3rem)'
                      : 'clamp(1.5rem, 4vw, 5rem)',
                  lineHeight: 1.3,
                  textShadow: hasTheme && theme.id === 'full-ambiance' ? '2px 2px 12px rgba(0,0,0,0.6)' : undefined,
                }}
              >
                {slide.details1}
              </p>
            )}
            {slide.details2 && (
              <p
                style={{
                  color: hasTheme ? theme.subtitleColor : 'rgba(255,255,255,0.8)',
                  fontSize: hasTheme
                    ? `clamp(${theme.typography.datetimeSize.min}px, ${theme.typography.datetimeSize.preferred}, ${theme.typography.datetimeSize.max}px)`
                    : slide.prayerTimingsEnabled
                      ? 'clamp(0.875rem, 2vw, 2.5rem)'
                      : 'clamp(1.25rem, 3vw, 4rem)',
                  lineHeight: 1.3,
                  textShadow: hasTheme && theme.id === 'full-ambiance' ? '2px 2px 12px rgba(0,0,0,0.6)' : undefined,
                }}
              >
                {slide.details2}
              </p>
            )}
          </div>

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="flex flex-col items-center" style={{ marginTop: hasTheme ? '20px' : undefined }}>
              <div
                style={{
                  background: hasTheme ? 'white' : undefined,
                  padding: hasTheme ? '24px' : undefined,
                  borderRadius: hasTheme ? '16px' : undefined,
                  border: hasTheme ? `3px solid ${theme.qrBorderColor}` : undefined,
                }}
              >
                <QRCodeDisplay
                  url={qrCodeUrl}
                  size={hasTheme || slide.prayerTimingsEnabled ? 'small' : 'large'}
                  className={slide.prayerTimingsEnabled ? 'mb-1' : 'mb-4'}
                />
              </div>
              {typeof slide.qrCode === 'object' && slide.qrCode !== null && 'label' in slide.qrCode && slide.qrCode.label && (
                <p className="text-white/70 mt-2 text-sm">{slide.qrCode.label}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Prayer Times Section - Only show if enabled */}
      {slide.prayerTimingsEnabled && prayerEntries.length > 0 && (
        <div className="h-[30%] border-t-4 border-teal-500 relative" style={{ zIndex: 2 }}>
          <div className="h-full flex items-center justify-between px-6">
            <div className="flex-1 flex justify-between items-center gap-3">
              {prayerEntries.map((prayer) => (
                <div
                  key={prayer.name}
                  className={`text-center flex-1 px-3 py-3 rounded-xl transition-all ${
                    prayer.isNext
                      ? 'bg-teal-500/30 text-white border-2 border-teal-500 shadow-lg'
                      : 'text-white bg-black/40 backdrop-blur-sm'
                  }`}
                >
                  <div className="font-semibold mb-1" style={{ fontSize: 'clamp(0.75rem, 1.5vw, 1.5rem)' }}>
                    {prayer.name}
                  </div>
                  <div className="opacity-75 text-xs mb-1">
                    Adhan: {formatTime(prayer.adhan)}
                  </div>
                  <div className="font-bold" style={{ fontSize: 'clamp(0.875rem, 1.8vw, 2rem)' }}>
                    {formatTime(prayer.iqamah)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomSlide
