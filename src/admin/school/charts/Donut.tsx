'use client'
import React from 'react'

export interface DonutSeg { label: string; value: number; color: string }

const Donut: React.FC<{ segments: DonutSeg[]; size?: number }> = ({ segments, size = 132 }) => {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const r = size / 2 - 12
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="ss-chart__donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Attendance status breakdown">
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="var(--theme-elevation-100)" strokeWidth={14} />
          {total > 0 && segments.map((s) => {
            const len = (s.value / total) * c
            const seg = <circle key={s.label} r={r} fill="none" stroke={s.color} strokeWidth={14}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            offset += len
            return seg
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" className="ss-chart__donutnum">{total}</text>
        <text x="50%" y="62%" textAnchor="middle" className="ss-chart__donutlbl">marks</text>
      </svg>
      <ul className="ss-chart__legend">
        {segments.map((s) => (
          <li key={s.label}><span style={{ background: s.color }} /> {s.label} <b>{s.value}</b></li>
        ))}
      </ul>
    </div>
  )
}

export default Donut
