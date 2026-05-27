'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CarouselLayout, { type CarouselSlide } from '../../_components/CarouselLayout'
import CustomSlide from '../../_components/CustomSlide'
import AdvertiserSlide from '../../_components/AdvertiserSlide'
import WeeklyEventsSlide from '../../_components/WeeklyEventsSlide'
import PrayerDisplay from '../../_components/prayer-display/PrayerDisplay'
import SalahTakeover from '../../_components/prayer-display/SalahTakeover'
import { pickVariant, pickContent, type PrayerVariant } from '@/lib/kiosk/prayerDisplaySelection'
import { computeSalahState, type IqamahPoint } from '@/lib/kiosk/salahWindow'
import { parseTimeToMinutes, type DayData } from '@/lib/kiosk/prayerTimetable'
import type { ContentEntry } from '@/lib/kiosk/prayerContentSeeds'
import CarouselErrorBoundary from '../../_components/CarouselErrorBoundary'

type Slide = {
  id: string
  type: 'carousel' | 'sponsor' | 'weekly-events'
  durationMs: number
  payload: any
}

type State = {
  tenant: { id: string; name: string; logo: string | null; timezone: string }
  prayerTimes: any
  slides: Slide[]
  version: string
  pollIntervalMs: number
  prayerDisplay: {
    dwellSeconds: number
    displayCity: string | null
    salahHoldoverMinutes: number
    salahManualUntil: string | null
    salahManualClearedAt: string | null
    contentPool: ContentEntry[]
  }
}

export default function KioskDisplayPage({
  params,
}: {
  params: Promise<{ deviceId: string }> | { deviceId: string }
}) {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const backoffRef = useRef(5000)

  const [showFullscreenHint, setShowFullscreenHint] = useState(true)

  useEffect(() => {
    Promise.resolve(params).then((p) => setDeviceId(p.deviceId))
  }, [params])

  // Tag the body so kiosk CSS (no cursor, no select, no callout) takes effect
  // on the display page but not on the pairing screen / admin.
  useEffect(() => {
    document.body.classList.add('kiosk-display')
    return () => {
      document.body.classList.remove('kiosk-display')
    }
  }, [])

  // Browsers require a user gesture to enter fullscreen — we can't auto-enter
  // on load. Listen for the first click/key/touch and promote the document.
  // Also suppress the context menu so right-click doesn't pop up on the TV.
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>
        }
        if (document.fullscreenElement) return
        if (el.requestFullscreen) await el.requestFullscreen()
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      } catch {
        // Some browsers/embedded webviews refuse fullscreen — ignore.
      } finally {
        setShowFullscreenHint(false)
      }
    }
    const onGesture = () => {
      void enterFullscreen()
      window.removeEventListener('click', onGesture)
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('touchstart', onGesture)
    }
    window.addEventListener('click', onGesture)
    window.addEventListener('keydown', onGesture)
    window.addEventListener('touchstart', onGesture, { passive: true })

    const suppressContextMenu = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('contextmenu', suppressContextMenu)

    // Auto-hide the hint after 8s even if the user never taps.
    const hideTimer = setTimeout(() => setShowFullscreenHint(false), 8000)

    return () => {
      window.removeEventListener('click', onGesture)
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('touchstart', onGesture)
      window.removeEventListener('contextmenu', suppressContextMenu)
      clearTimeout(hideTimer)
    }
  }, [])

  const credentials = useMemo(() => {
    if (!deviceId) return null
    return {
      deviceId,
      secret: typeof window !== 'undefined' ? localStorage.getItem('kiosk:secret') : null,
    }
  }, [deviceId])

  useEffect(() => {
    if (!credentials) return
    if (!credentials.secret) {
      window.location.replace('/kiosk')
      return
    }
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async () => {
      try {
        const res = await fetch('/api/kiosk/state', {
          headers: {
            'x-kiosk-device-id': credentials.deviceId,
            'x-kiosk-secret': credentials.secret!,
          },
        })
        if (res.status === 401) {
          localStorage.removeItem('kiosk:secret')
          localStorage.removeItem('kiosk:deviceId')
          window.location.replace('/kiosk')
          return
        }
        const json: State = await res.json()
        if (!active) return
        backoffRef.current = 5000
        setError(null)
        setState((prev) => {
          if (!prev) return json
          if (prev.version === json.version) return prev
          return json
        })
        timer = setTimeout(tick, json.pollIntervalMs || 60_000)
      } catch (e) {
        if (!active) return
        setError(String(e))
        backoffRef.current = Math.min(backoffRef.current * 2, 300_000)
        timer = setTimeout(tick, backoffRef.current)
      }
    }

    tick()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [credentials])

  // Prayer display variant + content re-rolling
  const [variant, setVariant] = useState<PrayerVariant>('cream')
  const [content, setContent] = useState<ContentEntry | null>(null)
  const seenRef = useRef<string[]>([])

  // Today's prayer day data
  const todayDay: DayData | null = useMemo(() => {
    const days = state?.prayerTimes?.days ?? []
    const n = new Date()
    return (
      days.find((d: any) => {
        const dd = new Date(d.date)
        return dd.getFullYear() === n.getFullYear() && dd.getMonth() === n.getMonth() && dd.getDate() === n.getDate()
      }) ?? null
    )
  }, [state?.prayerTimes])

  // Salah takeover state — evaluated every 5s
  const [salah, setSalah] = useState({ active: false, prayerName: null as string | null, iqamahLabel: null as string | null })
  useEffect(() => {
    if (!state) return
    const evaluate = () => {
      const now = new Date()
      const isFriday = now.getDay() === 5
      const jummah: string[] = state.prayerTimes?.jummahTimes?.map((j: any) => j.time).filter(Boolean) ?? []
      const order: { name: string; key: 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha' }[] = [
        { name: 'Fajr', key: 'fajr' }, { name: 'Dhuhr', key: 'zuhr' }, { name: 'Asr', key: 'asr' },
        { name: 'Maghrib', key: 'maghrib' }, { name: 'Isha', key: 'isha' },
      ]
      const iqamahs: IqamahPoint[] = order
        .map(({ name, key }) => {
          let label = todayDay?.[key]?.iqamah as string | undefined
          if (key === 'zuhr' && isFriday && jummah.length > 0) label = jummah[0]
          const minutes = parseTimeToMinutes(label)
          return label && minutes !== null ? { name, label, minutes } : null
        })
        .filter((x): x is IqamahPoint => x !== null)
      setSalah(
        computeSalahState({
          now,
          iqamahs,
          holdoverMinutes: state.prayerDisplay.salahHoldoverMinutes,
          manualUntil: state.prayerDisplay.salahManualUntil,
          manualClearedAt: state.prayerDisplay.salahManualClearedAt,
        }),
      )
    }
    evaluate()
    const t = setInterval(evaluate, 5_000)
    return () => clearInterval(t)
  }, [state, todayDay])

  // Always lead the rotation with prayer times — even if no other slides exist.
  // Memoize so the array reference stays stable across state polls when the
  // underlying slide ids haven't changed; otherwise CarouselLayout's
  // onSlideChange effect re-fires every 5s.
  const slidesKey = state ? state.slides.map((s) => `${s.type}:${s.id}`).join(',') : ''
  const dwellMs = (state?.prayerDisplay?.dwellSeconds ?? 10) * 1000
  const slidesWithPrayer = useMemo<CarouselSlide[]>(
    () => [
      { id: 'prayer-times', type: 'prayer-times', durationMs: dwellMs, payload: {} },
      ...(state?.slides ?? []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slidesKey, state?.slides.length, dwellMs],
  )

  // Report current slide to the server so admins can monitor what's on screen.
  const reportCurrentSlide = useCallback(
    (slide: CarouselSlide, index: number) => {
      if (!credentials?.secret) return
      const title =
        slide.type === 'prayer-times'
          ? 'Prayer Times'
          : (slide.payload as any)?.title ?? `${slide.type} slide`
      fetch('/api/kiosk/slide-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kiosk-device-id': credentials.deviceId,
          'x-kiosk-secret': credentials.secret,
        },
        body: JSON.stringify({
          title,
          type: slide.type,
          index,
          total: slidesWithPrayer.length,
          durationMs: slide.durationMs,
          startedAt: new Date().toISOString(),
        }),
      }).catch(() => {
        /* monitor reports are best-effort */
      })
    },
    [credentials, slidesWithPrayer.length],
  )

  const onSlideChange = useCallback(
    (slide: CarouselSlide, index: number) => {
      reportCurrentSlide(slide, index)
      if (slide.type === 'prayer-times') {
        setVariant((prev) => pickVariant(prev))
        const pool = state?.prayerDisplay?.contentPool ?? []
        const next = pickContent(pool, seenRef.current)
        if (next) {
          seenRef.current = [...seenRef.current, next.id]
          setContent(next)
        }
      }
    },
    [reportCurrentSlide, state?.prayerDisplay?.contentPool],
  )

  if (!state) {
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading…
      </main>
    )
  }

  const renderSlide = (slide: CarouselSlide) => {
    switch (slide.type) {
      case 'prayer-times':
        return (
          <PrayerDisplay
            variant={variant}
            content={content}
            day={todayDay}
            venueName={state.tenant.name}
            displayCity={state.prayerDisplay.displayCity}
            timezone={state.tenant.timezone}
            jummahTimes={state.prayerTimes?.jummahTimes?.map((j: any) => j.time).filter(Boolean) ?? []}
          />
        )
      case 'carousel':
        return <CustomSlide slide={slide.payload} prayerTimes={state.prayerTimes} />
      case 'sponsor':
        return <AdvertiserSlide slide={slide.payload} />
      case 'weekly-events':
        return <WeeklyEventsSlide slide={slide.payload} />
      default:
        return null
    }
  }

  return (
    <main
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <CarouselErrorBoundary>
        <CarouselLayout
          slides={slidesWithPrayer}
          renderSlide={renderSlide}
          onSlideChange={onSlideChange}
        />
      </CarouselErrorBoundary>
      {salah.active && (
        <SalahTakeover prayerName={salah.prayerName} iqamahLabel={salah.iqamahLabel} />
      )}
      {error && (
        <div style={{ position: 'absolute', top: 8, right: 8, opacity: 0.6 }}>● offline</div>
      )}
      <div className={`kiosk-fullscreen-hint${showFullscreenHint ? '' : ' is-hidden'}`}>
        Tap or press any key to enter fullscreen
      </div>
    </main>
  )
}
