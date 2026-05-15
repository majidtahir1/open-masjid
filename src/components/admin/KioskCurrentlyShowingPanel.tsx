'use client'

/**
 * Live monitor card on the Kiosks edit view.
 *
 * Polls /api/kiosks/<id> via Payload's REST API every 3s when the tab is
 * visible (and pauses when hidden) to surface the kiosk's most-recent
 * reported slide. Shows status, last-seen, slide title, type, "slide N of M",
 * and a progress bar based on durationMs + startedAt.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

type CurrentSlide = {
  title?: string | null
  type?: string | null
  index?: number | null
  total?: number | null
  durationMs?: number | null
  startedAt?: string | null
}

type KioskDoc = {
  id: string | number
  name?: string
  status?: 'ONLINE' | 'OFFLINE' | 'UNPAIRED' | 'MAINTENANCE'
  lastSeenAt?: string | null
  currentSlide?: CurrentSlide | null
}

const STATUS_META = {
  ONLINE:      { label: 'Online',      dot: '#16a34a', bg: '#dcfce7', fg: '#14532d' },
  OFFLINE:     { label: 'Offline',     dot: '#dc2626', bg: '#fee2e2', fg: '#7f1d1d' },
  UNPAIRED:    { label: 'Unpaired',    dot: '#6b7280', bg: '#f3f4f6', fg: '#374151' },
  MAINTENANCE: { label: 'Maintenance', dot: '#d97706', bg: '#fef3c7', fg: '#78350f' },
} as const

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const s = Math.floor(ms / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function KioskCurrentlyShowingPanel() {
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/')
  const kiosksIdx = segments.indexOf('kiosks')
  const docId = kiosksIdx !== -1 ? segments[kiosksIdx + 1] : undefined
  const isNewDoc = !docId || docId === 'create'

  const [doc, setDoc] = useState<KioskDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const visibleRef = useRef(true)

  // Tick once a second for the progress bar + "X seconds ago" labels.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (isNewDoc || !docId) return
    let cancelled = false
    const fetchDoc = async () => {
      if (!visibleRef.current) return
      try {
        const res = await fetch(`/api/kiosks/${docId}?depth=0`, { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) {
          setDoc(json as KioskDoc)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }
    fetchDoc()
    const id = setInterval(fetchDoc, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [docId, isNewDoc])

  if (isNewDoc) return null

  const status = doc?.status ?? 'UNPAIRED'
  const meta = STATUS_META[status]
  const slide = doc?.currentSlide ?? null
  const slideStartedAt = slide?.startedAt ? new Date(slide.startedAt).getTime() : null
  const elapsedMs = slideStartedAt ? Math.max(0, now - slideStartedAt) : 0
  const durationMs = slide?.durationMs ?? 0
  const progress = durationMs > 0 ? Math.min(100, (elapsedMs / durationMs) * 100) : 0
  const remainingMs = Math.max(0, durationMs - elapsedMs)

  return (
    <section style={styles.card}>
      <header style={styles.header}>
        <div style={styles.titleWrap}>
          <span style={styles.kicker}>Monitor</span>
          <h3 style={styles.title}>Currently Showing</h3>
        </div>
        <div
          style={{ ...styles.statusPill, background: meta.bg, color: meta.fg }}
          title={`Last seen ${timeAgo(doc?.lastSeenAt)}`}
        >
          <span style={{ ...styles.statusDot, background: meta.dot }} aria-hidden />
          {meta.label}
          {doc?.lastSeenAt && (
            <span style={styles.statusSub}>· last seen {timeAgo(doc.lastSeenAt)}</span>
          )}
        </div>
      </header>

      {!slide?.title ? (
        <div style={styles.empty}>
          {status === 'ONLINE'
            ? 'Waiting for the first slide report — should appear within seconds.'
            : 'No slide has been reported by this kiosk yet.'}
        </div>
      ) : (
        <>
          <div style={styles.slideRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.slideType}>{slide.type ?? 'Slide'}</div>
              <div style={styles.slideTitle} title={slide.title}>
                {slide.title}
              </div>
            </div>
            {typeof slide.index === 'number' && typeof slide.total === 'number' && (
              <div style={styles.counter}>
                <span style={styles.counterBig}>{slide.index + 1}</span>
                <span style={styles.counterSmall}>/ {slide.total}</span>
              </div>
            )}
          </div>

          {durationMs > 0 && (
            <div style={styles.progressWrap}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
          )}

          <div style={styles.footRow}>
            <span>{durationMs > 0 ? `${Math.round(remainingMs / 1000)}s remaining` : ''}</span>
            <span style={{ opacity: 0.7 }}>Updated {timeAgo(slide.startedAt)}</span>
          </div>
        </>
      )}

      {error && (
        <div style={styles.errorRow}>Lost connection to admin API ({error}) — retrying…</div>
      )}
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    margin: '0 0 24px 0',
    padding: '18px 20px',
    borderRadius: 12,
    background: 'var(--bg, #fff)',
    border: '1px solid var(--om-border, #e5e7eb)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--fg3, #6b7280)',
    fontWeight: 600,
  },
  title: {
    margin: 0,
    fontSize: 18,
    color: 'var(--fg1, #111827)',
    fontWeight: 600,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
  },
  statusSub: {
    opacity: 0.7,
    fontWeight: 500,
    marginLeft: 4,
  },
  empty: {
    padding: '20px 0',
    color: 'var(--fg3, #6b7280)',
    fontSize: 14,
  },
  slideRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  slideType: {
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--fg3, #6b7280)',
    fontWeight: 600,
    marginBottom: 4,
  },
  slideTitle: {
    fontSize: 18,
    color: 'var(--fg1, #111827)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  counter: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    color: 'var(--fg2, #374151)',
  },
  counterBig: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1,
  },
  counterSmall: {
    fontSize: 14,
    opacity: 0.6,
  },
  progressWrap: {
    height: 6,
    borderRadius: 999,
    background: 'var(--om-border, #e5e7eb)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    background: 'var(--brand, #1f3a8a)',
    transition: 'width 1s linear',
  },
  footRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: 'var(--fg3, #6b7280)',
  },
  errorRow: {
    marginTop: 12,
    fontSize: 12,
    color: '#7f1d1d',
  },
}
