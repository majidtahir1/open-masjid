'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import CarouselLayout, { type CarouselSlide } from '../../_components/CarouselLayout'
import CustomSlide from '../../_components/CustomSlide'
import AdvertiserSlide from '../../_components/AdvertiserSlide'
import WeeklyEventsSlide from '../../_components/WeeklyEventsSlide'
import PrayerTimesSlide from '../../_components/PrayerTimesSlide'
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

  useEffect(() => {
    Promise.resolve(params).then((p) => setDeviceId(p.deviceId))
  }, [params])

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
        return <PrayerTimesSlide prayerTimes={state.prayerTimes} tenantName={state.tenant.name} />
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

  // Always lead the rotation with prayer times — even if no other slides exist.
  const slidesWithPrayer: CarouselSlide[] = [
    { id: 'prayer-times', type: 'prayer-times', durationMs: 15000, payload: {} },
    ...state.slides,
  ]

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
        <CarouselLayout slides={slidesWithPrayer} renderSlide={renderSlide} />
      </CarouselErrorBoundary>
      {error && (
        <div style={{ position: 'absolute', top: 8, right: 8, opacity: 0.6 }}>● offline</div>
      )}
    </main>
  )
}
