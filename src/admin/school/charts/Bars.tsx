'use client'
import React from 'react'

export interface BarRow { label: string; value: number; display?: string }

/** Horizontal bars. `mode='ratio'` expects values in 0..1 and shows a %. */
const Bars: React.FC<{ rows: BarRow[]; color?: string; mode?: 'count' | 'ratio' }> = ({ rows, color = 'var(--ss-teal-500)', mode = 'count' }) => {
  const max = mode === 'ratio' ? 1 : Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="ss-emptyline">No data yet.</p>
  return (
    <div className="ss-chart__bars">
      {rows.map((r) => (
        <div key={r.label} className="ss-chart__bar">
          <span className="ss-chart__barlabel" title={r.label}>{r.label}</span>
          <span className="ss-chart__bartrack">
            <span className="ss-chart__barfill" style={{ width: `${Math.min(100, (r.value / max) * 100)}%`, background: color }} />
          </span>
          <span className="ss-chart__barval">{r.display ?? (mode === 'ratio' ? `${Math.round(r.value * 100)}%` : r.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default Bars
