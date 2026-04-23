/**
 * ActiveScheduleBanner
 *
 * A Payload `ui` field component injected at the top of each PrayerSchedule
 * edit page. Makes it unmistakable whether the schedule being edited is the
 * one currently shown on the public site, and surfaces the range + day count.
 */

'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

type ActiveInfo = {
  activeId: string | number | null
  activeName: string | null
}

type SavedDoc = {
  startDate?: string | null
  endDate?: string | null
  days?: unknown[] | null
}

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

function detectStatus(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now = new Date(),
): 'active' | 'future' | 'expired' | 'unknown' {
  if (!startDate || !endDate) return 'unknown'
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (now < start) return 'future'
  if (now > end) return 'expired'
  return 'active'
}

export default function ActiveScheduleBanner() {
  const { id, savedDocumentData } = useDocumentInfo()
  const [info, setInfo] = useState<ActiveInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/active-schedule', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && 'activeId' in data) setInfo(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!id) return null

  const doc = (savedDocumentData as SavedDoc | undefined) ?? {}
  const dayCount = Array.isArray(doc.days) ? doc.days.length : 0
  const status = detectStatus(doc.startDate, doc.endDate)
  const thisIsActive =
    info?.activeId != null && String(info.activeId) === String(id)

  const rangeText =
    doc.startDate && doc.endDate
      ? `${fmtDate(doc.startDate)} → ${fmtDate(doc.endDate)}`
      : null

  let tone: 'green' | 'amber' | 'gray' = 'gray'
  let title = ''
  let body: React.ReactNode = null

  if (thisIsActive) {
    tone = 'green'
    title = 'ACTIVE NOW'
    body = (
      <>
        This schedule is currently shown on your public site.
        {rangeText ? ` Range: ${rangeText}.` : ''}{' '}
        <strong>{dayCount}</strong> day{dayCount === 1 ? '' : 's'} configured.
      </>
    )
  } else if (status === 'future') {
    tone = 'amber'
    title = 'Not yet active'
    body = (
      <>
        Starts {fmtDate(doc.startDate)}.
        {rangeText ? ` Range: ${rangeText}.` : ''}{' '}
        <strong>{dayCount}</strong> day{dayCount === 1 ? '' : 's'} configured.
      </>
    )
  } else if (status === 'expired') {
    tone = 'gray'
    title = 'Expired'
    body = <>Ended {fmtDate(doc.endDate)}. No longer shown on the public site.</>
  } else if (info?.activeId != null) {
    tone = 'amber'
    title = 'Not active right now'
    const activeHref = `/admin/collections/prayer-schedules/${info.activeId}`
    body = (
      <>
        The active schedule is{' '}
        <a href={activeHref} style={{ color: 'inherit', textDecoration: 'underline' }}>
          {info.activeName ?? 'another schedule'}
        </a>
        . Edit that one to change what shows on the public site.
      </>
    )
  } else {
    return null
  }

  const palette = {
    green: { bg: '#dcfce7', border: '#16a34a', text: '#14532d' },
    amber: { bg: '#fef3c7', border: '#d97706', text: '#78350f' },
    gray: { bg: '#f1f5f9', border: '#64748b', text: '#334155' },
  }[tone]

  return (
    <div
      role="status"
      style={{
        marginBottom: '16px',
        padding: '12px 16px',
        borderRadius: '8px',
        background: palette.bg,
        borderLeft: `4px solid ${palette.border}`,
        color: palette.text,
        fontSize: '14px',
        lineHeight: 1.5,
      }}
    >
      <strong>{title}</strong> — {body}
    </div>
  )
}
