'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Image as ImageIcon,
  Sun,
  Sunset,
} from 'lucide-react'

import LucideIconByName from '../LucideIcon'
import {
  mediaAlt,
  mediaUrl,
  type HeroCta,
  type HeroLiveData,
  type HeroPhotoPattern,
  type HeroSlideLike,
  type PhotoTone,
} from '../types'

/* ---------- helpers ---------- */

export function resolveCtaHref(cta: HeroCta): string {
  if (cta.href) return cta.href
  if (cta.linkType === 'url' && cta.url) return cta.url
  if (cta.linkType === 'page' && cta.page) return cta.page
  if (cta.url) return cta.url
  if (cta.page) return cta.page
  return '#'
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

export function renderTitle(title: string): React.ReactNode {
  return title.split('\n').map((line, i) => (
    <span key={i} className="block">
      {line}
    </span>
  ))
}

export function usePrefersReducedMotion(): boolean {
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

/* ---------- HeroCopy: eyebrow + title + body + meta + CTAs ---------- */

export function HeroCopy({
  slide,
  active,
  onDark,
}: {
  slide: HeroSlideLike
  active: boolean
  onDark?: boolean
}) {
  return (
    <div className={`om-hero-copy ${onDark ? 'is-on-dark' : ''}`}>
      {slide.eyebrow && <div className="om-hero-eyebrow">{slide.eyebrow}</div>}
      <h1 className="om-hero-title">{renderTitle(slide.title)}</h1>
      {slide.body && <p className="om-hero-sub">{slide.body}</p>}
      {slide.meta && (
        <div className="om-hero-meta">
          <Calendar size={14} strokeWidth={1.75} />
          <span>{slide.meta}</span>
        </div>
      )}
      {slide.ctas && slide.ctas.length > 0 && (
        <div className="om-hero-ctas">
          {slide.ctas.map((cta, j) => (
            <CtaButton
              key={j}
              cta={cta}
              tabIndex={active ? 0 : -1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CtaButton({ cta, tabIndex }: { cta: HeroCta; tabIndex: number }) {
  const href = resolveCtaHref(cta)
  const isPrimary = cta.primary ?? false
  const className = `om-hero-btn ${isPrimary ? 'om-hero-btn-primary' : 'om-hero-btn-secondary'}`
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
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={tabIndex}
      >
        {content}
      </a>
    )
  }
  return (
    <Link href={href} className={className} tabIndex={tabIndex}>
      {content}
    </Link>
  )
}

/* ---------- SlideControls: dot nav + counter + arrows ---------- */

export function SlideControls({
  slides,
  idx,
  go,
  onDark,
}: {
  slides: HeroSlideLike[]
  idx: number
  go: (n: number) => void
  onDark?: boolean
}) {
  const total = slides.length
  if (total <= 1) return null
  const slide = slides[idx]
  const titleSnippet = slide?.title?.split('\n')[0] ?? ''
  return (
    <div className={`om-hero-ctrls ${onDark ? 'is-on-dark' : ''}`}>
      <div className="om-hero-count">
        <strong>{String(idx + 1).padStart(2, '0')}</strong>
        {' / '}
        {String(total).padStart(2, '0')}
        {titleSnippet && (
          <>
            {' · '}
            <span>{titleSnippet}</span>
          </>
        )}
      </div>
      <div className="om-hero-dots" role="tablist" aria-label="Slide selector">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`om-hero-dot ${i === idx ? 'is-active' : ''}`}
            onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-selected={i === idx}
            role="tab"
          />
        ))}
      </div>
      <div className="om-hero-nav">
        <button
          type="button"
          className="om-hero-arrow"
          onClick={() => go(idx - 1)}
          aria-label="Previous slide"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="om-hero-arrow"
          onClick={() => go(idx + 1)}
          aria-label="Next slide"
        >
          <ArrowRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

/* ---------- BgOrnament + PlaceholderImg ---------- */

export function BgOrnament({ big }: { big?: boolean }) {
  return (
    <div
      className={`om-hero-bg ${big ? 'is-big' : ''}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 800 600"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="om-hero-g1" cx="85%" cy="20%" r="55%">
            <stop offset="0%" stopColor="#5CB8C3" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#0E2A2C" stopOpacity="0" />
          </radialGradient>
          <pattern
            id="om-hero-stars"
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M40 28 L42 38 L52 40 L42 42 L40 52 L38 42 L28 40 L38 38 Z"
              fill="#3C8285"
              opacity="0.06"
            />
          </pattern>
        </defs>
        <rect width="800" height="600" fill="url(#om-hero-g1)" />
        <rect width="800" height="600" fill="url(#om-hero-stars)" />
      </svg>
    </div>
  )
}

/**
 * Map a semantic tone slot to the CSS variable that drives its color.
 * The wrapping `<div>` sets `color` to this variable so the SVG inside
 * can reference `currentColor` everywhere — meaning per-tenant brand
 * overrides flow through automatically with no React-level palette tables.
 */
const TONE_TO_VAR: Record<PhotoTone, string> = {
  brand: 'var(--brand)',
  secondary: 'var(--secondary)',
  accent: 'var(--accent)',
}

export function PlaceholderImg({
  label,
  tone = 'secondary',
  full,
  uid,
  pattern = 'arch',
}: {
  label?: string | null
  tone?: PhotoTone
  full?: boolean
  uid: string
  pattern?: HeroPhotoPattern
}) {
  return (
    <div
      className={`om-hero-ph om-hero-ph-${tone} ${full ? 'is-full' : ''}`}
      style={{ color: TONE_TO_VAR[tone] ?? TONE_TO_VAR.secondary }}
    >
      <svg
        viewBox="0 0 400 280"
        preserveAspectRatio="xMidYMid slice"
        className="om-hero-ph-svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`om-ph-grad-${uid}`} cx="60%" cy="35%" r="80%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </radialGradient>
        </defs>
        <rect width="400" height="280" fill={`url(#om-ph-grad-${uid})`} />
        <PatternForeground pattern={pattern} uid={uid} />
      </svg>
      {label && (
        <div className="om-hero-ph-label">
          <ImageIcon size={12} strokeWidth={1.75} />
          <span>{label}</span>
        </div>
      )}
    </div>
  )
}

function PatternForeground({
  pattern,
  uid,
}: {
  pattern: HeroPhotoPattern
  uid: string
}) {
  if (pattern === 'geometric') {
    // 8-pointed star tessellation — Khatam-style, layered subtly.
    return (
      <>
        <defs>
          <pattern
            id={`om-ph-geo-${uid}`}
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(0)"
          >
            <g
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.1"
            >
              <polygon points="40,8 48,32 72,40 48,48 40,72 32,48 8,40 32,32" />
              <polygon
                points="40,18 45,35 62,40 45,45 40,62 35,45 18,40 35,35"
                opacity="0.55"
              />
            </g>
          </pattern>
        </defs>
        <rect width="400" height="280" fill={`url(#om-ph-geo-${uid})`} />
        <rect width="400" height="280" fill="rgba(0,0,0,0.18)" />
      </>
    )
  }

  if (pattern === 'stars') {
    // Scattered subtle 4-pointed sparkle stars + a few larger highlights.
    return (
      <>
        <defs>
          <pattern
            id={`om-ph-stars-${uid}`}
            x="0"
            y="0"
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M60 36 L62 54 L80 56 L62 58 L60 76 L58 58 L40 56 L58 54 Z"
              fill="rgba(255,255,255,0.22)"
            />
            <path
              d="M16 12 L17 22 L27 23 L17 24 L16 34 L15 24 L5 23 L15 22 Z"
              fill="rgba(255,255,255,0.14)"
            />
            <path
              d="M104 88 L105 96 L113 97 L105 98 L104 106 L103 98 L95 97 L103 96 Z"
              fill="rgba(255,255,255,0.14)"
            />
          </pattern>
        </defs>
        <rect width="400" height="280" fill={`url(#om-ph-stars-${uid})`} />
        {/* A handful of larger accent stars for depth */}
        <g fill="rgba(255,255,255,0.32)">
          <path d="M340 64 L344 84 L364 88 L344 92 L340 112 L336 92 L316 88 L336 84 Z" />
          <path d="M70 200 L72 212 L84 214 L72 216 L70 228 L68 216 L56 214 L68 212 Z" />
        </g>
      </>
    )
  }

  if (pattern === 'lattice') {
    // Interlocking circles — Rub el Hizb / flower-of-life inspired lattice.
    return (
      <>
        <defs>
          <pattern
            id={`om-ph-lat-${uid}`}
            x="0"
            y="0"
            width="64"
            height="56"
            patternUnits="userSpaceOnUse"
          >
            <g
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
            >
              <circle cx="0" cy="0" r="22" />
              <circle cx="32" cy="0" r="22" />
              <circle cx="64" cy="0" r="22" />
              <circle cx="0" cy="56" r="22" />
              <circle cx="32" cy="56" r="22" />
              <circle cx="64" cy="56" r="22" />
              <circle cx="16" cy="28" r="22" />
              <circle cx="48" cy="28" r="22" />
            </g>
          </pattern>
        </defs>
        <rect width="400" height="280" fill={`url(#om-ph-lat-${uid})`} />
        <rect width="400" height="280" fill="rgba(0,0,0,0.20)" />
      </>
    )
  }

  // Default — arch (minaret silhouette) plus side strips.
  return (
    <>
      <g
        opacity="0.35"
        transform="translate(140 60)"
        fill="rgba(255,255,255,0.85)"
      >
        <path d="M60 0 C92 0 116 24 116 56 L116 200 L4 200 L4 56 C4 24 28 0 60 0 Z" />
        <rect x="56" y="-22" width="8" height="22" />
        <circle cx="60" cy="-30" r="6" />
      </g>
      <rect x="20" y="100" width="6" height="100" fill="rgba(255,255,255,0.18)" />
      <rect x="374" y="100" width="6" height="100" fill="rgba(255,255,255,0.18)" />
      <rect x="0" y="200" width="400" height="80" fill="rgba(0,0,0,0.25)" />
    </>
  )
}

/* ---------- NextIqamahCard: server-supplied data, client countdown ---------- */

export function NextIqamahCard({
  data,
}: {
  data: NonNullable<HeroLiveData['nextIqamah']> | null | undefined
}) {
  const initialSecs = data?.secondsUntil ?? 0
  const [secs, setSecs] = useState(initialSecs)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    setSecs(initialSecs)
  }, [initialSecs])

  useEffect(() => {
    if (!data) return
    const id = window.setInterval(() => {
      setSecs((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [data])

  if (!data) {
    return (
      <div className="om-hero-iqamah">
        <div className="om-hero-iqamah-top">
          <span className="om-hero-iqamah-eye">
            <Sun size={13} strokeWidth={2} /> Next iqamah
          </span>
        </div>
        <div className="om-hero-iqamah-row">
          <div>
            <div className="om-hero-iqamah-name">Soon</div>
            <div className="om-hero-iqamah-at">Schedule coming</div>
          </div>
        </div>
      </div>
    )
  }

  const hours = Math.floor(secs / 3600)
  const minutes = Math.floor((secs % 3600) / 60)
  const seconds = secs % 60

  return (
    <div className="om-hero-iqamah">
      <div className="om-hero-iqamah-top">
        <span className="om-hero-iqamah-eye">
          <Sun size={13} strokeWidth={2} /> Next iqamah
        </span>
      </div>
      <div className="om-hero-iqamah-row">
        <div>
          <div className="om-hero-iqamah-name">{data.name}</div>
          <div className="om-hero-iqamah-at">at {data.atTime}</div>
        </div>
        <div
          className="om-hero-iqamah-count"
          aria-label={
            hours > 0
              ? `${hours} hours ${minutes} minutes until iqamah`
              : `${minutes} minutes ${seconds} seconds until iqamah`
          }
        >
          <span className="om-hero-iqamah-prefix">in</span>
          {hours > 0 ? (
            <>
              <span className="om-hero-iqamah-num">{hours}</span>
              <span className="om-hero-iqamah-unit">h</span>
              <span className="om-hero-iqamah-num">{minutes}</span>
              <span className="om-hero-iqamah-unit">m</span>
            </>
          ) : (
            <>
              <span className="om-hero-iqamah-num">
                {String(minutes).padStart(2, '0')}
              </span>
              <span className="om-hero-iqamah-unit">m</span>
              <span className="om-hero-iqamah-num">
                {String(seconds).padStart(2, '0')}
              </span>
              <span className="om-hero-iqamah-unit">s</span>
            </>
          )}
        </div>
      </div>
      {reduced ? null : null}
    </div>
  )
}

/* ---------- FeaturePhotoCard for split variant ---------- */

export function FeaturePhotoCard({
  slide,
  uid,
}: {
  slide: HeroSlideLike
  uid: string
}) {
  const f = slide.splitFields
  const url = mediaUrl(f?.image)
  const alt = mediaAlt(f?.image, f?.photoLabel ?? slide.title ?? '')
  const tone = (f?.photoTone ?? 'teal') as PhotoTone
  const tag = f?.cardTag ?? slide.eyebrow ?? ''
  const title = f?.cardTitle ?? slide.title ?? ''
  const label = f?.photoLabel ?? null
  return (
    <div className="om-hero-photo-card">
      <div className="om-hero-photo-card-img">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} loading="lazy" />
        ) : (
          <PlaceholderImg label={label} tone={tone} uid={`split-${uid}`} />
        )}
      </div>
      <div className="om-hero-photo-card-cap">
        {tag && <div className="om-hero-photo-card-tag">{tag}</div>}
        {title && <div className="om-hero-photo-card-title">{title}</div>}
      </div>
    </div>
  )
}

/* ---------- UpcomingTeaser ---------- */

export function UpcomingTeaser({
  slide,
  onClick,
}: {
  slide: HeroSlideLike | null
  onClick: () => void
}) {
  if (!slide) return null
  const dayLabel = slide.meta?.match(/\b\d{1,2}\b/)?.[0] ?? '↗'
  const title = slide.title?.split('\n').join(' ')
  return (
    <button type="button" className="om-hero-teaser" onClick={onClick}>
      <div className="om-hero-teaser-date">
        <span className="d-num">{dayLabel}</span>
        <span className="d-mo">Up next</span>
      </div>
      <div className="om-hero-teaser-body">
        {slide.eyebrow && <div className="om-hero-teaser-tag">{slide.eyebrow}</div>}
        <div className="om-hero-teaser-title">{title}</div>
        {(slide.meta ?? slide.splitFields?.cardTag) && (
          <div className="om-hero-teaser-meta">
            {slide.meta ?? slide.splitFields?.cardTag}
          </div>
        )}
      </div>
      <ArrowRight
        size={18}
        strokeWidth={1.75}
        className="om-hero-teaser-arrow"
      />
    </button>
  )
}

/* ---------- LiveWidget ---------- */

export function LiveWidget({
  liveData,
}: {
  liveData: HeroLiveData | null | undefined
}) {
  const next = liveData?.nextIqamah ?? null
  const events = liveData?.upcomingEvents ?? []

  const iqamahLabel = next
    ? next.secondsUntil > 0
      ? formatRelative(next.secondsUntil)
      : 'Now'
    : '—'

  const isEmpty = !next && events.length === 0
  return (
    <div className="om-hero-now">
      <div className="om-hero-now-body">
        {next && (
          <div className="om-hero-now-row is-teal">
            <div className="om-hero-now-icon">
              <Sunset size={18} strokeWidth={1.75} />
            </div>
            <div className="om-hero-now-text">
              <div className="om-hero-now-label">{next.name} iqamah</div>
              <div className="om-hero-now-value">{iqamahLabel}</div>
              <div className="om-hero-now-sub">at {next.atTime}</div>
            </div>
          </div>
        )}
        {events.map((ev) => (
          <Link key={ev.id} href={ev.href} className="om-hero-now-row">
            <div className="om-hero-now-icon">
              <Calendar size={18} strokeWidth={1.75} />
            </div>
            <div className="om-hero-now-text">
              <div className="om-hero-now-label">Upcoming</div>
              <div className="om-hero-now-value">{ev.title}</div>
              {ev.when && <div className="om-hero-now-sub">{ev.when}</div>}
            </div>
          </Link>
        ))}
        {isEmpty && (
          <div className="om-hero-now-empty">No upcoming events scheduled.</div>
        )}
      </div>
      <div className="om-hero-now-foot">
        <Link href="/events" className="om-hero-now-link">
          See full schedule <ArrowRight size={13} strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  )
}

function formatRelative(secs: number): string {
  if (secs < 60) return `in ${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `in ${mins} min`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  if (remMins === 0) return `in ${hrs}h`
  return `in ${hrs}h ${remMins}m`
}

/* ---------- AyahCard ---------- */

const DEFAULT_AYAH = {
  ar: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا',
  tr: '"Indeed, prayer is decreed upon the believers at specified times."',
  cite: 'An-Nisa · 4:103',
}

export function AyahCard({ slide }: { slide: HeroSlideLike }) {
  const f = slide.photoFields
  const ar = f?.ayahArabic?.trim() || DEFAULT_AYAH.ar
  const tr = f?.ayahTranslation?.trim() || DEFAULT_AYAH.tr
  const cite = f?.ayahCitation?.trim() || DEFAULT_AYAH.cite
  return (
    <div className="om-hero-quote">
      <div className="om-hero-quote-ar" dir="rtl">{ar}</div>
      <div className="om-hero-quote-tr">{tr}</div>
      <div className="om-hero-quote-cite">{cite}</div>
    </div>
  )
}
