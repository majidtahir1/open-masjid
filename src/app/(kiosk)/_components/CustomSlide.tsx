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

  // Resolve slide image URL (attached via the Media library)
  const slideImageUrl = useMemo(() => {
    if (!slide.image || typeof slide.image === 'string') return null
    return slide.image.url ?? null
  }, [slide.image])

  // Image-backed slides render the image on a dark backdrop with the title
  // hidden. If the image fails to load (transient network blip, or the file
  // isn't served yet right after upload), don't leave a permanent black slide
  // on an unattended display: fall back to the title/theme and retry the image
  // periodically so it self-heals without a manual refresh.
  const [imgFailed, setImgFailed] = useState(false)
  const [imgAttempt, setImgAttempt] = useState(0)
  useEffect(() => {
    setImgFailed(false)
    setImgAttempt(0)
  }, [slideImageUrl])
  useEffect(() => {
    if (!imgFailed) return
    const t = setTimeout(() => {
      setImgFailed(false)
      setImgAttempt((n) => n + 1)
    }, 15_000)
    return () => clearTimeout(t)
  }, [imgFailed])
  const showImage = Boolean(slideImageUrl) && !imgFailed

  return (
    <div
      className="w-full h-full flex flex-col relative"
      style={{
        background: hasTheme ? theme.backgroundColor : currentGradient.css,
        transition: 'background 2s ease-in-out',
      }}
    >
      {/* Slide image (highest priority — overrides theme & gradient). Rendered
          as an <img> so we can catch load failures via onError and fall back
          to the title/theme instead of a permanent black screen. */}
      {showImage && (
        <div
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ backgroundColor: '#000', zIndex: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={imgAttempt}
            src={slideImageUrl as string}
            alt=""
            onError={() => setImgFailed(true)}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Islamic Pattern Background Overlay (theme bg pattern — skipped when slide image is shown) */}
      {!showImage && hasTheme && theme.backgroundImage !== 'none' && (
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
        className={`flex-1 flex items-center justify-center overflow-hidden relative ${
          !hasTheme ? (slide.prayerTimingsEnabled ? 'px-6 pt-12 pb-2' : 'px-6 py-8') : ''
        }`}
        style={{
          paddingTop: hasTheme ? theme.safeZones.topMargin : undefined,
          paddingBottom: hasTheme ? theme.safeZones.bottomMargin : undefined,
          paddingLeft: hasTheme ? theme.safeZones.sidePadding : undefined,
          paddingRight: hasTheme ? theme.safeZones.sidePadding : undefined,
          zIndex: 2,
        }}
      >
        <div className="text-center max-w-[85%] w-full">
          {/* Title — hidden when the slide image is shown (the image is the
              message). Shown as the fallback if the image fails to load. */}
          {!showImage && (
            <h1
              className={`font-display font-bold ${
                slide.prayerTimingsEnabled
                  ? 'text-tv-xl mb-3 leading-tight'
                  : 'text-tv-hero mb-6 leading-tight'
              }`}
              style={{
                color: hasTheme ? theme.textColor : 'white',
                fontSize: hasTheme
                  ? `clamp(${theme.typography.titleSize.min}px, ${theme.typography.titleSize.preferred}, ${theme.typography.titleSize.max}px)`
                  : undefined,
                textShadow: hasTheme && theme.id === 'full-ambiance' ? '3px 3px 16px rgba(0,0,0,0.8)' : undefined,
              }}
            >
              {slide.title}
            </h1>
          )}

          {/* Details */}
          <div className={`space-y-2 ${slide.prayerTimingsEnabled ? 'mb-3' : 'mb-8'}`}>
            {slide.details1 && (
              <p
                className={`font-sans leading-snug ${
                  slide.prayerTimingsEnabled ? 'text-tv-md' : 'text-tv-xl'
                }`}
                style={{
                  color: hasTheme ? theme.subtitleColor : 'rgba(255,255,255,0.9)',
                  fontSize: hasTheme
                    ? `clamp(${theme.typography.subtitleSize.min}px, ${theme.typography.subtitleSize.preferred}, ${theme.typography.subtitleSize.max}px)`
                    : undefined,
                  textShadow: hasTheme && theme.id === 'full-ambiance' ? '2px 2px 12px rgba(0,0,0,0.6)' : undefined,
                }}
              >
                {slide.details1}
              </p>
            )}
            {slide.details2 && (
              <p
                className={`font-sans leading-snug ${
                  slide.prayerTimingsEnabled ? 'text-tv-base' : 'text-tv-lg'
                }`}
                style={{
                  color: hasTheme ? theme.subtitleColor : 'rgba(255,255,255,0.8)',
                  fontSize: hasTheme
                    ? `clamp(${theme.typography.datetimeSize.min}px, ${theme.typography.datetimeSize.preferred}, ${theme.typography.datetimeSize.max}px)`
                    : undefined,
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
                  background: hasTheme
                    ? theme.id === 'full-ambiance'
                      ? 'linear-gradient(135deg, #F4E5C3 0%, #D4AF37 100%)'
                      : 'white'
                    : undefined,
                  padding: hasTheme ? '24px' : undefined,
                  borderRadius: hasTheme ? '16px' : undefined,
                  boxShadow: hasTheme
                    ? theme.id === 'full-ambiance'
                      ? '0 12px 48px rgba(0,0,0,0.5)'
                      : '0 8px 32px rgba(0,0,0,0.2)'
                    : undefined,
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
                <p className="text-tv-sm text-white/70 mt-2">{slide.qrCode.label}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Prayer Times Section - Only show if enabled */}
      {slide.prayerTimingsEnabled && prayerEntries.length > 0 && (
        <div className="h-[30%] border-t-4 border-secondary relative" style={{ zIndex: 2 }}>
          <div className="h-full flex items-center justify-between px-6">
            <div className="flex-1 flex justify-between items-center gap-3">
              {prayerEntries.map((prayer) => (
                <div
                  key={prayer.name}
                  className={`text-center flex-1 px-3 py-3 rounded-xl transition-all ${
                    prayer.isNext
                      ? 'bg-secondary/30 text-white border-2 border-secondary shadow-lg'
                      : 'text-white bg-black/40 backdrop-blur-sm'
                  }`}
                >
                  <div className="text-tv-md font-sans font-semibold mb-1">
                    {prayer.name}
                  </div>
                  <div className="text-tv-sm font-sans opacity-75 mb-1">
                    Adhan: {formatTime(prayer.adhan)}
                  </div>
                  <div className="text-tv-lg font-sans font-bold">
                    {formatTime(prayer.iqamah)}
                  </div>
                </div>
              ))}
            </div>

            {/* Next Prayer Countdown */}
            <div className="text-center ml-4 bg-black/40 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg min-w-[200px]">
              <div className="text-tv-base text-white font-semibold mb-1">Next Prayer In</div>
              <div className="text-tv-lg font-bold text-white drop-shadow-lg">
                {(() => {
                  if (!prayerEntries.length) return '—'
                  const next = prayerEntries.find((p) => p.isNext)
                  if (!next?.adhan) return '—'
                  const m = /(\d{1,2}):(\d{2})/.exec(next.adhan)
                  if (!m) return '—'
                  const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes()
                  const targetMins = Number(m[1]) * 60 + Number(m[2])
                  const diff = targetMins - nowMins
                  if (diff <= 0) return '—'
                  const h = Math.floor(diff / 60)
                  const min = diff % 60
                  return h > 0 ? `${h}h ${min}m` : `${min}m`
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomSlide
