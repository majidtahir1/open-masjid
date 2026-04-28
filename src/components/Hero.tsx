'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './hero/hero-variants.css'
import { SlideControls, usePrefersReducedMotion } from './hero/parts'
import {
  HeroLive,
  HeroOriginal,
  HeroPhoto,
  HeroSplit,
} from './hero/variants'
import type { HeroLiveData, HeroSlideLike, HeroStyle } from './types'

export interface HeroProps {
  slides: HeroSlideLike[]
  /** Auto-advance interval in ms. Default 7000. Set 0 to disable. */
  intervalMs?: number
  /** Server-supplied data for variants that show live info (split/live/photo). */
  liveData?: HeroLiveData | null
}

export default function Hero({ slides, intervalMs = 7000, liveData }: HeroProps) {
  const hasSlides = slides && slides.length > 0
  const count = slides?.length ?? 0
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const rootRef = useRef<HTMLElement | null>(null)

  const go = useCallback(
    (n: number) => {
      if (count === 0) return
      setIdx(((n % count) + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (!hasSlides || count <= 1) return
    if (paused || reducedMotion || intervalMs <= 0) return
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % count)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [paused, reducedMotion, intervalMs, count, hasSlides])

  const onFocus = useCallback(() => setPaused(true), [])
  const onBlur = useCallback((e: React.FocusEvent) => {
    if (!rootRef.current) return
    if (rootRef.current.contains(e.relatedTarget as Node | null)) return
    setPaused(false)
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (count <= 1) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(idx - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(idx + 1)
      }
    },
    [go, idx, count],
  )

  const activeStyle: HeroStyle = useMemo(() => {
    if (!hasSlides) return 'original'
    return slides[idx]?.style ?? 'original'
  }, [slides, idx, hasSlides])

  if (!hasSlides) return null

  return (
    <section
      ref={rootRef}
      className={`om-hero-section ${activeStyle === 'photo' ? 'om-photo-active' : ''}`}
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <div className="om-hero-slides">
        {slides.map((slide, i) => {
          const active = i === idx
          const style = (slide.style ?? 'original') as HeroStyle
          const next =
            count > 1 ? slides[(i + 1) % count] ?? null : null
          const onJumpToNext = () => go(i + 1)
          const uid = String(slide.id ?? i)
          return (
            <div
              key={slide.id ?? i}
              className={[
                'om-hero-slide',
                active ? 'is-active' : '',
                style === 'photo' ? 'is-photo' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-hidden={!active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
            >
              <VariantRenderer
                style={style}
                slide={slide}
                nextSlide={next}
                active={active}
                liveData={liveData}
                uid={uid}
                onJumpToNext={onJumpToNext}
              />
            </div>
          )
        })}
      </div>

      <div className="om-hero-ctrls-wrap">
        <SlideControls
          slides={slides}
          idx={idx}
          go={go}
          onDark={activeStyle === 'photo'}
        />
      </div>
    </section>
  )
}

function VariantRenderer({
  style,
  slide,
  nextSlide,
  active,
  liveData,
  uid,
  onJumpToNext,
}: {
  style: HeroStyle
  slide: HeroSlideLike
  nextSlide: HeroSlideLike | null
  active: boolean
  liveData?: HeroLiveData | null
  uid: string
  onJumpToNext: () => void
}) {
  const props = { slide, nextSlide, active, liveData, uid, onJumpToNext }
  if (style === 'photo') return <HeroPhoto {...props} />
  if (style === 'live') return <HeroLive {...props} />
  if (style === 'split') return <HeroSplit {...props} />
  return <HeroOriginal {...props} />
}
