'use client'
import React from 'react'

export interface TrendDatum { label: string; value: number } // value 0..1

const AreaTrend: React.FC<{ data: TrendDatum[]; height?: number }> = ({ data, height = 120 }) => {
  if (data.length === 0) return <p className="ss-emptyline">No attendance recorded yet.</p>
  const w = 480
  const pad = 6
  const n = data.length
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (n - 1))
  const y = (v: number) => height - pad - v * (height - 2 * pad)
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`
  return (
    <svg className="ss-chart__area" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Attendance trend">
      <defs>
        <linearGradient id="ss-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ss-teal-500)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--ss-teal-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ss-area-grad)" />
      <path d={line} fill="none" stroke="var(--ss-teal-500)" strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => <circle key={d.label} cx={x(i)} cy={y(d.value)} r={2.5} fill="var(--ss-teal-600)" />)}
    </svg>
  )
}

export default AreaTrend
