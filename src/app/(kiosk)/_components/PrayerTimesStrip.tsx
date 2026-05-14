'use client'

import { useEffect, useState } from 'react'

interface Props {
  prayerTimes: any
  tenantName: string
}

export function PrayerTimesStrip({ prayerTimes, tenantName }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!prayerTimes) {
    return <footer style={stripStyle}>{tenantName}</footer>
  }

  const today = (prayerTimes.days ?? []).find((d: any) => sameDay(new Date(d.date), now))
  if (!today) return <footer style={stripStyle}>{tenantName}</footer>

  const items: Array<[string, string, string | undefined]> = [
    ['Fajr', today.fajr, today.iqamah?.fajr],
    ['Dhuhr', today.dhuhr, today.iqamah?.dhuhr],
    ['Asr', today.asr, today.iqamah?.asr],
    ['Maghrib', today.maghrib, today.iqamah?.maghrib],
    ['Isha', today.isha, today.iqamah?.isha],
  ]

  return (
    <footer style={stripStyle}>
      {items.map(([name, adhan, iqamah]) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ opacity: 0.6, fontSize: '1rem' }}>{name}</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 600 }}>{fmt(adhan)}</span>
          {iqamah && <span style={{ opacity: 0.7, fontSize: '0.95rem' }}>Iqamah {fmt(iqamah)}</span>}
        </div>
      ))}
    </footer>
  )
}

const stripStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'space-around',
  padding: '1rem 2rem',
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(8px)',
  color: '#fff',
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const fmt = (raw: string | undefined) => {
  if (!raw) return '—'
  const m = /(\d{1,2}):(\d{2})/.exec(raw)
  if (!m) return raw
  let h = Number(m[1])
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${m[2]} ${ampm}`
}
