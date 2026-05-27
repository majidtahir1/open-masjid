'use client'

/**
 * Live monitor card on the Kiosks edit view.
 *
 * Polls /api/kiosks/<id> via Payload's REST API every 3s while the tab is
 * visible (and pauses when hidden) to surface the kiosk's most-recent
 * reported slide. Shows status pill, last-seen, slide title/type, slide N
 * of M counter, and a progress bar based on durationMs + startedAt.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Monitor, Wifi, WifiOff, Wrench, KeySquare } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type CurrentSlide = {
  title?: string | null
  type?: string | null
  index?: number | null
  total?: number | null
  durationMs?: number | null
  startedAt?: string | null
}

type Status = 'ONLINE' | 'OFFLINE' | 'UNPAIRED' | 'MAINTENANCE'

type KioskDoc = {
  id: string | number
  name?: string
  status?: Status
  lastSeenAt?: string | null
  currentSlide?: CurrentSlide | null
}

const STATUS_META: Record<
  Status,
  {
    label: string
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    pill: string
  }
> = {
  ONLINE: {
    label: 'Online',
    Icon: Wifi,
    pill: 'bg-emerald-100 text-emerald-700',
  },
  OFFLINE: {
    label: 'Offline',
    Icon: WifiOff,
    pill: 'bg-rose-100 text-rose-700',
  },
  UNPAIRED: {
    label: 'Unpaired',
    Icon: KeySquare,
    pill: 'bg-muted text-muted-foreground',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    Icon: Wrench,
    pill: 'bg-amber-100 text-amber-700',
  },
}

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

function prettyType(t: string | null | undefined): string {
  if (!t) return 'Slide'
  if (t === 'prayer-times') return 'Prayer Times'
  if (t === 'sponsor') return 'Sponsor'
  if (t === 'carousel') return 'Carousel'
  if (t === 'weekly-events') return 'Weekly Events'
  return t
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

  const status: Status = doc?.status ?? 'UNPAIRED'
  const meta = STATUS_META[status]
  const StatusIcon = meta.Icon
  const slide = doc?.currentSlide ?? null
  const startedAtMs = slide?.startedAt ? new Date(slide.startedAt).getTime() : null
  const elapsedMs = startedAtMs ? Math.max(0, now - startedAtMs) : 0
  const durationMs = slide?.durationMs ?? 0
  const progress = durationMs > 0 ? Math.min(100, (elapsedMs / durationMs) * 100) : 0
  const remainingMs = Math.max(0, durationMs - elapsedMs)

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-6 md:p-8">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Monitor
          </p>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Monitor className="size-5 text-secondary" aria-hidden />
            Currently Showing
          </CardTitle>
        </div>
        <Badge
          variant="secondary"
          className={cn('gap-1.5 px-3 py-1.5 text-xs font-semibold', meta.pill)}
        >
          <StatusIcon className="size-3.5" aria-hidden />
          {meta.label}
          {doc?.lastSeenAt && (
            <span className="ml-1 font-normal opacity-75">· {timeAgo(doc.lastSeenAt)}</span>
          )}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 p-6 pt-0 md:p-8 md:pt-0">
        {!slide?.title ? (
          <p className="italic text-base text-muted-foreground">
            {status === 'ONLINE'
              ? 'Waiting for the first slide report — should appear within seconds.'
              : 'No slide has been reported by this kiosk yet.'}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {prettyType(slide.type)}
                </p>
                <p
                  className="truncate text-2xl font-semibold text-foreground"
                  title={slide.title}
                >
                  {slide.title}
                </p>
              </div>
              {typeof slide.index === 'number' && typeof slide.total === 'number' && (
                <div className="flex items-baseline gap-1 text-foreground">
                  <span className="text-4xl font-bold leading-none">{slide.index + 1}</span>
                  <span className="text-base text-muted-foreground">/ {slide.total}</span>
                </div>
              )}
            </div>

            {durationMs > 0 && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{durationMs > 0 ? `${Math.round(remainingMs / 1000)}s remaining` : ''}</span>
              <span className="opacity-75">Updated {timeAgo(slide.startedAt)}</span>
            </div>
          </>
        )}

        {error && (
          <p className="text-xs text-destructive">
            Lost connection to admin API ({error}) — retrying…
          </p>
        )}
      </CardContent>
    </Card>
  )
}
