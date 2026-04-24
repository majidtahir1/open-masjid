'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Calendar } from 'lucide-react'

import LucideIconByName from './LucideIcon'
import type { Accent, HeroCta, HeroSlideLike } from './types'

export interface HeroProps {
  slides: HeroSlideLike[]
  /** Auto-advance interval in ms. Default 7000. Set 0 to disable. */
  intervalMs?: number
}


function resolveCtaHref(cta: HeroCta): string {
  if (cta.href) return cta.href
  if (cta.linkType === 'url' && cta.url) return cta.url
  if (cta.linkType === 'page' && cta.page) return cta.page
  if (cta.url) return cta.url
  if (cta.page) return cta.page
  return '#'
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

const ACCENT_CLASSES: Record<Accent, { wrap: string; title: string; eyebrow: string; body: string; meta: string }> = {
  cream: {
    wrap: 'bg-bg text-fg1',
    title: 'text-fg1',
    eyebrow: 'text-brand',
    body: 'text-fg2',
    meta: 'text-fg3',
  },
  teal: {
    wrap: 'bg-gradient-to-br from-teal-100 to-cream text-fg1',
    title: 'text-fg1',
    eyebrow: 'text-teal-700',
    body: 'text-fg2',
    meta: 'text-fg3',
  },
  gold: {
    wrap: 'bg-gradient-to-br from-gold-100 to-cream text-fg1',
    title: 'text-fg1',
    eyebrow: 'text-navy-700',
    body: 'text-fg2',
    meta: 'text-fg3',
  },
  navy: {
    wrap: 'bg-navy-700 text-white',
    title: 'text-white',
    eyebrow: 'text-teal-200',
    body: 'text-white/85',
    meta: 'text-white/75',
  },
}

/** Render hero title, splitting on newlines. Callers may pass plain strings. */
function renderTitle(title: string): React.ReactNode {
  const parts = title.split('\n')
  return parts.map((line, i) => (
    <span key={i} className="block">
      {line}
    </span>
  ))
}

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefers(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return prefers
}

export default function Hero({ slides, intervalMs = 7000 }: HeroProps) {
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

  // Pause on focus-within for keyboard users.
  const onFocus = useCallback(() => setPaused(true), [])
  const onBlur = useCallback((e: React.FocusEvent) => {
    if (!rootRef.current) return
    if (rootRef.current.contains(e.relatedTarget as Node | null)) return
    setPaused(false)
  }, [])

  // Keyboard arrow nav on the section.
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

  const activeAccent: Accent = useMemo(() => {
    if (!hasSlides) return 'cream'
    return slides[idx]?.accent ?? 'cream'
  }, [slides, idx, hasSlides])

  if (!hasSlides) {
    // Nothing to show — render nothing. Pages can render their own empty state.
    return null
  }

  return (
    <section
      ref={rootRef}
      className="relative overflow-hidden bg-bg"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <div className="relative min-h-[620px]">
        {slides.map((slide, i) => {
          const active = i === idx
          const accent = slide.accent ?? 'cream'
          const classes = ACCENT_CLASSES[accent]
          return (
            <div
              key={slide.id ?? i}
              className={[
                'absolute inset-0 flex items-center px-0 py-24 pb-[140px]',
                classes.wrap,
                reducedMotion
                  ? active
                    ? 'opacity-100'
                    : 'opacity-0 pointer-events-none'
                  : [
                      'transition-[opacity,transform] duration-[600ms] ease-out',
                      active
                        ? 'opacity-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 translate-y-2 pointer-events-none',
                    ].join(' '),
              ].join(' ')}
              aria-hidden={!active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
            >
              {accent === 'cream' && <HeroBgPattern />}
              <div className="relative z-[1] mx-auto w-full max-w-page px-6">
                <div className="max-w-[720px]">
                  {slide.eyebrow && (
                    <div
                      className={[
                        'mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps',
                        classes.eyebrow,
                      ].join(' ')}
                    >
                      {slide.eyebrow}
                    </div>
                  )}
                  <h1
                    className={[
                      'mb-[22px] font-display font-medium tracking-tight',
                      'text-[44px] leading-tight md:text-[64px] md:leading-[1.05] lg:text-[72px]',
                      classes.title,
                    ].join(' ')}
                  >
                    {renderTitle(slide.title)}
                  </h1>
                  {slide.body && (
                    <p
                      className={[
                        'mb-6 max-w-[560px] text-fs-md leading-relaxed',
                        classes.body,
                      ].join(' ')}
                    >
                      {slide.body}
                    </p>
                  )}
                  {slide.meta && (
                    <div
                      className={[
                        'mb-6 inline-flex items-center gap-2 font-mono text-[13px]',
                        classes.meta,
                      ].join(' ')}
                    >
                      <Calendar size={14} strokeWidth={1.75} />
                      <span>{slide.meta}</span>
                    </div>
                  )}
                  {slide.ctas && slide.ctas.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {slide.ctas.map((cta, j) => {
                        const href = resolveCtaHref(cta)
                        const isPrimary = cta.primary ?? false
                        const primaryClasses =
                          accent === 'navy'
                            ? 'bg-white text-brand hover:bg-white/90'
                            : 'bg-brand text-white hover:bg-brand-hover'
                        const secondaryClasses =
                          accent === 'navy'
                            ? 'bg-transparent text-white border border-white/30 hover:bg-white/10'
                            : 'bg-white text-brand border border-border-teal hover:bg-brand-soft hover:border-brand'
                        const className = [
                          'inline-flex items-center gap-2 rounded-[var(--r-md)] px-6 py-[14px]',
                          'font-body text-[15px] font-semibold transition-all duration-base ease-out',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                          isPrimary ? primaryClasses : secondaryClasses,
                        ].join(' ')
                        const content = (
                          <>
                            {cta.icon ? (
                              <LucideIconByName
                                name={cta.icon}
                                fallbackName="arrow-right"
                                size={16}
                                strokeWidth={1.75}
                              />
                            ) : null}
                            <span>{cta.label}</span>
                          </>
                        )
                        if (isExternal(href)) {
                          return (
                            <a
                              key={j}
                              href={href}
                              className={className}
                              target="_blank"
                              rel="noopener noreferrer"
                              tabIndex={active ? 0 : -1}
                            >
                              {content}
                            </a>
                          )
                        }
                        return (
                          <Link
                            key={j}
                            href={href}
                            className={className}
                            tabIndex={active ? 0 : -1}
                          >
                            {content}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[2]">
          <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-6">
            <div className="pointer-events-auto flex gap-2" role="tablist" aria-label="Slide selector">
              {slides.map((_, i) => {
                const active = i === idx
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i)}
                    className={[
                      'h-1 rounded-[2px] border-0 p-0 transition-all duration-base ease-out',
                      activeAccent === 'navy'
                        ? active
                          ? 'w-10 bg-white'
                          : 'w-7 bg-white/25 hover:bg-white/50'
                        : active
                          ? 'w-10 bg-brand'
                          : 'w-7 bg-brand/20 hover:bg-brand/40',
                    ].join(' ')}
                    aria-label={`Go to slide ${i + 1}`}
                    aria-selected={active}
                    role="tab"
                  />
                )
              })}
            </div>
            <div className="pointer-events-auto flex items-center gap-[10px]">
              <span
                className={[
                  'font-mono text-[12px] tracking-wide',
                  activeAccent === 'navy' ? 'text-white/80' : 'text-fg3',
                ].join(' ')}
              >
                {String(idx + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => go(idx - 1)}
                aria-label="Previous slide"
                className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--r-md)] border border-border bg-white text-fg1 shadow-sh-sm transition-colors duration-base ease-out hover:border-brand hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <ArrowLeft size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => go(idx + 1)}
                aria-label="Next slide"
                className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--r-md)] border border-border bg-white text-fg1 shadow-sh-sm transition-colors duration-base ease-out hover:border-brand hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <ArrowRight size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function HeroBgPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <svg
        viewBox="0 0 800 600"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="icp-hero-grad" cx="60%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#549A9C" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0E2A2C" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="600" fill="url(#icp-hero-grad)" />
        <g opacity="0.06" transform="translate(560,120)" fill="#3C8285">
          <path d="M100 0 C140 0 170 30 170 70 L170 220 L30 220 L30 70 C30 30 60 0 100 0 Z" />
          <circle cx="100" cy="-20" r="6" />
        </g>
      </svg>
    </div>
  )
}
