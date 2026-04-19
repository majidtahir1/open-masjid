/**
 * ScheduleNameCell
 *
 * Custom Payload 3 Cell component rendered in the `name` column of the
 * PrayerSchedules list view. For the row whose id matches the current active
 * schedule (resolved server-side via /api/active-schedule), we render a loud
 * green "ACTIVE NOW" pill next to the name and tint the cell background so
 * the row reads as highlighted. All other rows render the plain name.
 *
 * Payload 3's Cell API doesn't let us style the whole `<tr>`, so making the
 * Name cell visually prominent is the simplest way to convey "this row is
 * the one driving the public site."
 *
 * All rows share a single module-level fetch of /api/active-schedule so we
 * don't hit the endpoint once per row.
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
}

export default function ScheduleNameCell({
  rowData,
  cellData,
}: {
  rowData?: RowData
  cellData?: unknown
}) {
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

  const name = typeof cellData === 'string' ? cellData : ''

  if (!rowData || !loaded) {
    return <span>{name}</span>
  }

  const id = rowData.id
  const isActive = id != null && activeId != null && String(id) === String(activeId)

  if (!isActive) {
    return <span>{name}</span>
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        background: '#dcfce7',
        padding: '8px 12px',
        borderRadius: 6,
        borderLeft: '4px solid #16a34a',
        color: '#14532d',
        fontWeight: 700,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          borderRadius: 999,
          background: '#16a34a',
          color: '#ffffff',
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 999,
            background: '#ffffff',
          }}
        />
        Active now
      </span>
      <span>{name}</span>
    </span>
  )
}
