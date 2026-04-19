/**
 * ScheduleNameCell
 *
 * Custom Payload 3 Cell component rendered in the `name` column of the
 * PrayerSchedules list view. For the row whose id matches the active schedule
 * for the row's tenant (resolved server-side via /api/active-schedules), we
 * render a loud green "ACTIVE NOW" pill next to the name and tint the cell
 * background so the row reads as highlighted. All other rows render the plain
 * name.
 *
 * In either state, the name is wrapped in a Next.js Link to the schedule's
 * edit page so the column keeps its click-to-edit behavior that Payload's
 * default Name cell provides.
 *
 * Payload 3's Cell API doesn't let us style the whole `<tr>`, so making the
 * Name cell visually prominent is the simplest way to convey "this row is
 * the one driving the public site."
 *
 * All rows share a single module-level fetch of /api/active-schedules so we
 * don't hit the endpoint once per row.
 */

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type ActiveMap = Record<string, string | number | null>

let cachedPromise: Promise<ActiveMap> | null = null
function getActiveMap(): Promise<ActiveMap> {
  if (!cachedPromise) {
    cachedPromise = fetch('/api/active-schedules', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
  }
  return cachedPromise
}

type TenantRef =
  | string
  | number
  | { id?: string | number }
  | null
  | undefined

type RowData = {
  id?: string | number
  tenant?: TenantRef
}

function extractTenantId(t: TenantRef): string | number | undefined {
  if (t == null) return undefined
  if (typeof t === 'object') return t.id
  return t
}

const linkStyle: React.CSSProperties = {
  textDecoration: 'underline',
  color: 'inherit',
}

export default function ScheduleNameCell({
  rowData,
  cellData,
}: {
  rowData?: RowData
  cellData?: unknown
}) {
  const [activeMap, setActiveMap] = useState<ActiveMap>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getActiveMap().then((m) => {
      if (cancelled) return
      setActiveMap(m ?? {})
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const name = typeof cellData === 'string' ? cellData : ''
  const id = rowData?.id
  const editHref =
    id != null ? `/admin/collections/prayer-schedules/${id}` : undefined

  const nameLink = editHref ? (
    <Link href={editHref} style={linkStyle}>
      {name}
    </Link>
  ) : (
    <span>{name}</span>
  )

  if (!rowData || !loaded) {
    return nameLink
  }

  const tenantId = extractTenantId(rowData.tenant)
  const activeId = tenantId != null ? activeMap[String(tenantId)] : null
  const isActive =
    id != null && activeId != null && String(id) === String(activeId)

  if (!isActive) {
    return nameLink
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
      {editHref ? (
        <Link href={editHref} style={linkStyle}>
          {name}
        </Link>
      ) : (
        <span>{name}</span>
      )}
    </span>
  )
}
