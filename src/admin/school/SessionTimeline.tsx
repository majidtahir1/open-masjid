'use client'
import React from 'react'
import { weeklyDates } from '@/hooks/generateClassSessions'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function label(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}`
}

/**
 * The calendar rhythm: one bead per weekly meeting day between a term's dates.
 * Days off (holidays) render greyed. When `onToggle` is provided each bead is a
 * button — clicking marks that week off / on, so admins can drop holidays right
 * on the timeline. Non-interactive (hub) just displays the rhythm.
 */
const SessionTimeline: React.FC<{
  startDate?: string | null
  endDate?: string | null
  meetingDay?: string | null
  holidays?: string[]
  onToggle?: (iso: string) => void
  variant?: 'masthead' | 'inline'
  max?: number
}> = ({ startDate, endDate, meetingDay, holidays = [], onToggle, variant = 'masthead', max = 80 }) => {
  if (!startDate || !endDate) return null
  // Full set of meeting days (including days off) so every week is visible/toggleable.
  const all = weeklyDates(startDate, endDate, meetingDay ?? 'sunday')
  if (all.length === 0) return null
  const off = new Set(holidays.map((h) => String(h).slice(0, 10)))

  const shown = all.slice(0, max)
  const overflow = all.length - shown.length
  const interactive = typeof onToggle === 'function'

  return (
    <div className={`ss-rhythm${variant === 'inline' ? ' ss-rhythm--inline' : ''}`}>
      {shown.map((iso, i) => {
        const isOff = off.has(iso)
        const cls = `ss-bead${isOff ? ' ss-bead--off' : ''}${interactive ? ' ss-bead--toggle' : ''}`
        // Stagger only the first paint; once mounted the element persists across
        // toggles (stable key), so no re-animation on click.
        const style = { animationDelay: `${Math.min(i * 30, 700)}ms` } as React.CSSProperties
        const inner = (
          <>
            <span className="ss-bead__dot" />
            <span className="ss-bead__label">{label(iso)}</span>
          </>
        )
        return interactive ? (
          <button
            key={iso}
            type="button"
            className={cls}
            style={style}
            aria-pressed={!isOff}
            title={isOff ? 'Day off — click to add this week back' : 'Click to mark this week off'}
            onClick={() => onToggle!(iso)}
          >
            {inner}
          </button>
        ) : (
          <span key={iso} className={cls} style={style}>{inner}</span>
        )
      })}
      {overflow > 0 && (
        <span className="ss-bead" style={{ animationDelay: `${Math.min(shown.length * 30, 700)}ms` }}>
          <span className="ss-bead__dot" style={{ background: 'currentColor', opacity: 0.5 }} />
          <span className="ss-bead__label">+{overflow}</span>
        </span>
      )}
    </div>
  )
}

export default SessionTimeline
