/**
 * ActiveScheduleBanner
 *
 * A Payload `ui` field component injected at the top of each PrayerSchedule
 * edit page. Makes it unmistakable whether the schedule being edited is the
 * one currently shown on the public site.
 *
 * - Green "ACTIVE NOW" badge if this schedule is the active one.
 * - Amber "Not active" badge with a link to the actually-active schedule if
 *   not.
 *
 * The active-schedule lookup lives server-side at /api/active-schedule and
 * uses the same resolver as the public site, so the banner can never drift
 * out of sync with what's actually rendered.
 */

'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

type ActiveInfo = {
  activeId: string | number | null
  activeName: string | null
}

export default function ActiveScheduleBanner() {
  const { id } = useDocumentInfo()
  const [info, setInfo] = useState<ActiveInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/active-schedule', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && 'activeId' in data) setInfo(data)
      })
      .catch(() => {
        // Silently ignore — the banner is an enhancement, not critical.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Nothing to show on the create form (no id yet) or before the fetch resolves.
  if (!id || !info) return null
  if (info.activeId == null) return null

  const isActive = String(info.activeId) === String(id)

  const style: React.CSSProperties = {
    marginBottom: '16px',
    padding: '12px 16px',
    borderRadius: '8px',
    background: isActive ? '#dcfce7' : '#fef3c7',
    borderLeft: `4px solid ${isActive ? '#16a34a' : '#d97706'}`,
    color: isActive ? '#14532d' : '#78350f',
    fontWeight: 500,
    fontSize: '14px',
    lineHeight: 1.5,
  }

  if (isActive) {
    return (
      <div style={style} role="status">
        <strong>ACTIVE NOW</strong> — this schedule is currently shown on your
        public site.
      </div>
    )
  }

  const activeHref = `/admin/collections/prayer-schedules/${info.activeId}`
  return (
    <div style={style} role="status">
      <strong>Not active right now</strong> — the active schedule is{' '}
      <a
        href={activeHref}
        style={{ color: 'inherit', textDecoration: 'underline' }}
      >
        {info.activeName ?? 'another schedule'}
      </a>
      . Edit that one to change what shows on the public site.
    </div>
  )
}
