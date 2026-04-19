/**
 * ScheduleStatusCell
 *
 * Custom Payload 3 Cell component for the PrayerSchedules list view. Renders a
 * clear badge per row:
 *   - green "ACTIVE NOW"   — this row is the currently-served schedule
 *   - blue  "Upcoming"     — startDate is in the future
 *   - gray  "Fallback"     — baseline schedule (isCurrent === true)
 *   - gray  "Past / Inactive" — otherwise
 *
 * All rows independently render this cell, so they share a single
 * module-level fetch of /api/active-schedule to avoid N requests per page.
 */

'use client'

import { useEffect, useState } from 'react'

type ActiveInfo = { activeId: string | number | null; activeName?: string | null }

let cachedPromise: Promise<ActiveInfo> | null = null
function getActive(): Promise<ActiveInfo> {
  if (!cachedPromise) {
    cachedPromise = fetch('/api/active-schedule', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { activeId: null }))
      .catch(() => ({ activeId: null }))
  }
  return cachedPromise
}

type RowData = {
  id?: string | number
  startDate?: string | null
  isCurrent?: boolean
}

const baseBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
}

export default function ScheduleStatusCell({ rowData }: { rowData?: RowData }) {
  const [activeId, setActiveId] = useState<string | number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getActive().then((d) => {
      if (cancelled) return
      setActiveId(d?.activeId ?? null)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!rowData || !loaded) {
    return <span style={{ color: '#9ca3af' }}>—</span>
  }

  const id = rowData.id
  const isActive = id != null && activeId != null && String(id) === String(activeId)

  if (isActive) {
    return (
      <span
        style={{
          ...baseBadge,
          background: '#dcfce7',
          color: '#14532d',
          border: '1px solid #16a34a',
        }}
      >
        ACTIVE NOW
      </span>
    )
  }

  const now = Date.now()
  const startTs = rowData.startDate ? new Date(rowData.startDate).getTime() : NaN
  if (!Number.isNaN(startTs) && startTs > now) {
    return (
      <span
        style={{
          ...baseBadge,
          background: '#dbeafe',
          color: '#1e3a8a',
          border: '1px solid #3b82f6',
        }}
      >
        Upcoming
      </span>
    )
  }

  if (rowData.isCurrent === true) {
    return (
      <span
        style={{
          ...baseBadge,
          background: '#f3f4f6',
          color: '#374151',
          border: '1px solid #9ca3af',
        }}
      >
        Fallback
      </span>
    )
  }

  return (
    <span
      style={{
        ...baseBadge,
        background: '#f9fafb',
        color: '#6b7280',
        border: '1px solid #d1d5db',
      }}
    >
      Past / Inactive
    </span>
  )
}
