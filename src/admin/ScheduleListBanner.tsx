/**
 * ScheduleListBanner
 *
 * Rendered above the PrayerSchedules list view via
 * `admin.components.beforeListTable`. Shows a prominent green callout naming
 * the currently-active schedule so staff immediately know which record is
 * driving the public site.
 */

'use client'

import { useEffect, useState } from 'react'

type ActiveInfo = {
  activeId: string | number | null
  activeName: string | null
}

export default function ScheduleListBanner() {
  const [info, setInfo] = useState<ActiveInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/active-schedule', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && 'activeId' in data) setInfo(data)
      })
      .catch(() => {
        // Banner is an enhancement — fail quietly.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!info?.activeName) return null

  return (
    <div
      role="status"
      style={{
        margin: '0 0 16px 0',
        padding: '14px 18px',
        borderRadius: 10,
        background: '#dcfce7',
        borderLeft: '4px solid #16a34a',
        color: '#14532d',
        fontWeight: 600,
        fontSize: '0.95rem',
      }}
    >
      <span aria-hidden="true">✓ </span>
      Currently active schedule: <strong>{info.activeName}</strong> — this is
      what the public site displays right now.
    </div>
  )
}
