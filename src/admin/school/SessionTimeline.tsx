'use client'
import React from 'react'
import { weeklyDates } from '@/hooks/generateClassSessions'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function label(iso: string): string {
  // iso is YYYY-MM-DD (UTC date-only from weeklyDates) — parse without TZ drift.
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}`
}

/**
 * The calendar rhythm: one bead per weekly session between a term's dates.
 * Makes the abstract "sessions auto-generate" tangible. Caps the rendered
 * beads so a long term stays readable; the count is always shown in full.
 */
const SessionTimeline: React.FC<{
  startDate?: string | null
  endDate?: string | null
  meetingDay?: string | null
  variant?: 'masthead' | 'inline'
  max?: number
}> = ({ startDate, endDate, meetingDay, variant = 'masthead', max = 20 }) => {
  if (!startDate || !endDate) return null
  const dates = weeklyDates(startDate, endDate, meetingDay ?? 'sunday')
  if (dates.length === 0) return null

  const shown = dates.slice(0, max)
  const overflow = dates.length - shown.length

  return (
    <div className={`ss-rhythm${variant === 'inline' ? ' ss-rhythm--inline' : ''}`} aria-hidden="true">
      {shown.map((iso, i) => (
        <div key={iso} className="ss-bead" style={{ animationDelay: `${Math.min(i * 35, 700)}ms` }}>
          <span className="ss-bead__dot" />
          <span className="ss-bead__label">{label(iso)}</span>
        </div>
      ))}
      {overflow > 0 && (
        <div className="ss-bead" style={{ animationDelay: `${Math.min(shown.length * 35, 700)}ms` }}>
          <span className="ss-bead__dot" style={{ background: 'currentColor', opacity: 0.5 }} />
          <span className="ss-bead__label">+{overflow}</span>
        </div>
      )}
    </div>
  )
}

export default SessionTimeline
