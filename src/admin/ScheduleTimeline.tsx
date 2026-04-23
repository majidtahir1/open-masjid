/**
 * ScheduleTimeline
 *
 * Rendered above the PrayerSchedules list view. Shows every schedule as a
 * horizontal bar positioned along a date axis so overlapping ranges and the
 * "active today" winner are visible at a glance.
 *
 * - One bar per schedule, positioned by startDate/endDate.
 * - Schedules that overlap are assigned to separate lanes so bars never
 *   visually overlap.
 * - A red vertical "Today" line crosses all lanes.
 * - The currently active schedule (most recent startDate whose range covers
 *   today) is outlined to make the resolver's winner unmistakable.
 *
 * Server Component — fetches schedules server-side at render time via
 * getPayload, so the timeline is in the initial HTML.
 */

import { getPayload } from 'payload'
import { headers as nextHeaders } from 'next/headers'
import React from 'react'

import config from '@payload-config'

type Schedule = {
  id: string | number
  name?: string | null
  startDate?: string | null
  endDate?: string | null
}

const LANE_HEIGHT = 32
const LANE_GAP = 6
const BAR_COLORS = ['#0F1E4A', '#28A0B4', '#B8954F', '#6B5397', '#2F6F3A', '#A9434A']

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
}

function fmtMonth(d: Date): string {
  // Full year so "Jun 2026" doesn't read as "Jun 26" (day 26).
  return d.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Treat endDate as inclusive-end-of-day: the bar covers through end of that UTC day. */
const DAY_MS = 24 * 60 * 60 * 1000

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

/**
 * Pack schedules into non-overlapping lanes using a greedy algorithm.
 * Sort by startDate asc, place each in the first lane whose last bar
 * ends before this one starts.
 */
function assignLanes(schedules: Schedule[]): Array<Schedule & { lane: number }> {
  const sorted = [...schedules]
    .filter((s) => s.startDate && s.endDate)
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
  const laneEnds: number[] = []
  const out: Array<Schedule & { lane: number }> = []
  for (const s of sorted) {
    const start = new Date(s.startDate!).getTime()
    const end = new Date(s.endDate!).getTime()
    let lane = laneEnds.findIndex((last) => last < start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    out.push({ ...s, lane })
  }
  return out
}

/**
 * Determine which schedule is "active" per the resolver rule — most recent
 * startDate among those that cover today.
 */
function findActiveId(schedules: Schedule[], now = new Date()): string | number | null {
  const nowMs = now.getTime()
  const covering = schedules.filter((s) => {
    if (!s.startDate || !s.endDate) return false
    return new Date(s.startDate).getTime() <= nowMs && new Date(s.endDate).getTime() >= nowMs
  })
  if (covering.length === 0) return null
  covering.sort(
    (a, b) => new Date(b.startDate!).getTime() - new Date(a.startDate!).getTime(),
  )
  return covering[0].id
}

export default async function ScheduleTimeline() {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await nextHeaders() })
    if (!user) return null

    const tenantRef = (user as { tenant?: unknown }).tenant
    const tenantId =
      typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
        ? (tenantRef as { id: string | number }).id
        : (tenantRef as string | number | undefined)

    const whereClause = tenantId ? { tenant: { equals: tenantId } } : undefined

    const res = await payload.find({
      collection: 'prayer-schedules',
      where: whereClause,
      sort: '-startDate',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    const schedules = res.docs as Schedule[]
    const datedSchedules = schedules.filter((s) => s.startDate && s.endDate)
    if (datedSchedules.length === 0) return null

    const lanes = assignLanes(datedSchedules)
    const laneCount = Math.max(...lanes.map((l) => l.lane)) + 1
    const activeId = findActiveId(datedSchedules)

    // Axis span: pad a week on each side. endDate is inclusive (covers through
    // end of that UTC day), so add 24h before measuring the max.
    const minMs = Math.min(...lanes.map((l) => new Date(l.startDate!).getTime()))
    const maxMs = Math.max(
      ...lanes.map((l) => new Date(l.endDate!).getTime() + DAY_MS),
    )
    const padMs = 7 * 24 * 60 * 60 * 1000
    const axisStart = new Date(minMs - padMs)
    const axisEnd = new Date(maxMs + padMs)
    const axisSpan = axisEnd.getTime() - axisStart.getTime()
    const pct = (t: number) => ((t - axisStart.getTime()) / axisSpan) * 100

    // Month ticks: every 1st of month within the axis range.
    const ticks: Date[] = []
    let cursor = new Date(
      Date.UTC(axisStart.getUTCFullYear(), axisStart.getUTCMonth() + 1, 1),
    )
    while (cursor.getTime() < axisEnd.getTime()) {
      ticks.push(new Date(cursor))
      cursor = addMonths(cursor, 1)
    }

    const nowMs = Date.now()
    const showToday = nowMs >= axisStart.getTime() && nowMs <= axisEnd.getTime()
    const chartHeight = laneCount * (LANE_HEIGHT + LANE_GAP)

    return (
      <div
        style={{
          margin: '0 0 20px 0',
          padding: '18px 20px 14px',
          borderRadius: 10,
          background: 'var(--theme-elevation-50, #f8fafc)',
          border: '1px solid var(--theme-elevation-150, #e2e8f0)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 10,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--theme-text-light, #64748b)',
          }}
        >
          <span>Schedule timeline</span>
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {showToday ? 'Red line = today' : 'Today is outside this range'}
          </span>
        </div>
        <div
          style={{
            position: 'relative',
            height: chartHeight,
            marginBottom: 24,
          }}
        >
          {/* Month grid lines */}
          {ticks.map((t) => (
            <div
              key={t.toISOString()}
              style={{
                position: 'absolute',
                left: `${pct(t.getTime())}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'var(--theme-elevation-200, #cbd5e1)',
                opacity: 0.6,
              }}
            />
          ))}
          {/* Today line */}
          {showToday ? (
            <div
              style={{
                position: 'absolute',
                left: `${pct(nowMs)}%`,
                top: -4,
                bottom: -4,
                width: 2,
                background: '#dc2626',
                boxShadow: '0 0 0 1px rgba(220,38,38,0.2)',
                zIndex: 2,
              }}
              title="Today"
            />
          ) : null}
          {/* Schedule bars */}
          {lanes.map((s, i) => {
            const start = new Date(s.startDate!).getTime()
            // Inclusive end-of-day: extend 24h so consecutive schedules are flush.
            const end = new Date(s.endDate!).getTime() + DAY_MS
            const left = pct(start)
            const width = Math.max(pct(end) - pct(start), 1)
            const color = BAR_COLORS[i % BAR_COLORS.length]
            const isActive = activeId != null && String(s.id) === String(activeId)
            return (
              <a
                key={s.id}
                href={`/admin/collections/prayer-schedules/${s.id}`}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${width}%`,
                  top: s.lane * (LANE_HEIGHT + LANE_GAP),
                  height: LANE_HEIGHT,
                  background: color,
                  color: '#fff',
                  borderRadius: 4,
                  padding: '0 10px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  outline: isActive ? '2px solid #16a34a' : 'none',
                  outlineOffset: 2,
                  boxShadow: isActive ? '0 0 0 1px rgba(22,163,74,0.4)' : 'none',
                  zIndex: 1,
                }}
                title={`${s.name ?? 'Schedule'} — ${fmtDay(s.startDate)} → ${fmtDay(s.endDate)}${isActive ? ' · ACTIVE NOW' : ''}`}
              >
                {isActive ? '★ ' : ''}
                {s.name ?? 'Schedule'}
              </a>
            )
          })}
        </div>
        {/* Month labels */}
        <div
          style={{
            position: 'relative',
            height: 16,
            fontSize: 11,
            color: 'var(--theme-text-light, #64748b)',
          }}
        >
          {ticks.map((t) => (
            <div
              key={t.toISOString()}
              style={{
                position: 'absolute',
                left: `${pct(t.getTime())}%`,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {fmtMonth(t)}
            </div>
          ))}
        </div>
      </div>
    )
  } catch {
    return null
  }
}
