'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React from 'react'

type Pair = { adhan?: string | null; iqamah?: string | null } | null | undefined
type DayRow = {
  date?: string | null
  sunrise?: string | null
  fajr?: Pair
  zuhr?: Pair
  asr?: Pair
  maghrib?: Pair
  isha?: Pair
}

type Row =
  | { kind: 'adhan'; key: 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha'; name: string }
  | { kind: 'sunrise'; name: string }

const ROWS: Row[] = [
  { kind: 'adhan', key: 'fajr', name: 'Fajr' },
  { kind: 'sunrise', name: 'Sunrise (Fajr ends)' },
  { kind: 'adhan', key: 'zuhr', name: 'Zuhr' },
  { kind: 'adhan', key: 'asr', name: 'Asr' },
  { kind: 'adhan', key: 'maghrib', name: 'Maghrib' },
  { kind: 'adhan', key: 'isha', name: 'Isha' },
]

function fmt(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

export default function AdhanRangePreview() {
  const { savedDocumentData } = useDocumentInfo()
  const doc = (savedDocumentData as { days?: DayRow[] | null } | undefined) ?? {}
  const days = Array.isArray(doc.days) ? doc.days : []
  const first = days[0]
  const last = days.length > 1 ? days[days.length - 1] : null

  const wrap: React.CSSProperties = {
    marginBottom: '1rem',
    padding: '14px 16px',
    borderRadius: 6,
    border: '1px solid var(--theme-elevation-150, #e2e8f0)',
    background: 'var(--theme-elevation-50, #f8fafc)',
    fontSize: 13,
  }
  const heading: React.CSSProperties = {
    margin: '0 0 10px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--theme-text-light, #64748b)',
  }

  if (days.length === 0) {
    return (
      <div style={wrap}>
        <h4 style={heading}>Adhan preview</h4>
        <p style={{ margin: 0, color: 'var(--theme-text-light, #64748b)' }}>
          Save the schedule to see computed adhan times at the start and end of the range.
          These help you pick iqamah times that work across the full range (Fajr and Isha
          drift most between seasons).
        </p>
      </div>
    )
  }

  const cellStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderBottom: '1px solid var(--theme-elevation-100, #edf2f7)',
    fontVariantNumeric: 'tabular-nums',
  }
  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--theme-text-light, #64748b)',
    textAlign: 'left',
  }

  return (
    <div style={wrap}>
      <h4 style={heading}>Adhan preview</h4>
      <p
        style={{
          margin: '0 0 10px',
          color: 'var(--theme-text-light, #64748b)',
        }}
      >
        Computed adhan times at the start and end of the range. Use these to pick iqamah
        times that work across the full range (e.g. Fajr iqamah should sit safely after
        the latest Fajr adhan).
      </p>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            <th style={headerCellStyle}>Prayer</th>
            <th style={headerCellStyle}>{fmt(first?.date)} (first)</th>
            {last ? <th style={headerCellStyle}>{fmt(last?.date)} (last)</th> : null}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const rowKey = row.kind === 'adhan' ? row.key : 'sunrise'
            const f =
              row.kind === 'adhan'
                ? (first?.[row.key] as Pair)?.adhan ?? '—'
                : first?.sunrise ?? '—'
            const l =
              row.kind === 'adhan'
                ? (last?.[row.key] as Pair)?.adhan ?? '—'
                : last?.sunrise ?? '—'
            const isSunrise = row.kind === 'sunrise'
            return (
              <tr key={rowKey}>
                <td
                  style={{
                    ...cellStyle,
                    fontWeight: isSunrise ? 500 : 600,
                    fontStyle: isSunrise ? 'italic' : undefined,
                    color: isSunrise
                      ? 'var(--theme-text-light, #64748b)'
                      : undefined,
                  }}
                >
                  {row.name}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    fontStyle: isSunrise ? 'italic' : undefined,
                    color: isSunrise
                      ? 'var(--theme-text-light, #64748b)'
                      : undefined,
                  }}
                >
                  {f}
                </td>
                {last ? (
                  <td
                    style={{
                      ...cellStyle,
                      fontStyle: isSunrise ? 'italic' : undefined,
                      color: isSunrise
                        ? 'var(--theme-text-light, #64748b)'
                        : undefined,
                    }}
                  >
                    {l}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
