'use client'

import React from 'react'

export interface SalahTakeoverProps {
  prayerName: string | null
  iqamahLabel: string | null
}

export default function SalahTakeover({ prayerName, iqamahLabel }: SalahTakeoverProps) {
  const header =
    prayerName && iqamahLabel
      ? `Now praying — ${prayerName} · Iqamah ${iqamahLabel}`
      : 'Now praying'
  return (
    <div
      className="pd-screen pd-salah"
      style={{ position: 'absolute', inset: 0, zIndex: 40 }}
    >
      <div className="pd-salah-prayer">{header}</div>
      <div className="pd-salah-ornament">۞ ۞ ۞</div>
      <div className="pd-salah-call">حَيَّ عَلى ٱلصَّلاة</div>
      <div className="pd-salah-title">Salah is in progress</div>
      <div className="pd-salah-sub">Please silence your phone</div>
    </div>
  )
}
