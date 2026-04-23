'use client'

import { useRowLabel } from '@payloadcms/ui'
import React from 'react'

type DayRowData = {
  date?: string | null
  fajr?: { adhan?: string | null; iqamah?: string | null } | null
  isha?: { adhan?: string | null; iqamah?: string | null } | null
}

function fmt(iso?: string | null): string {
  if (!iso) return 'New day'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

export default function DayRowLabel() {
  const { data, rowNumber } = useRowLabel<DayRowData>()
  const label = fmt(data?.date)
  const fajr = data?.fajr?.adhan?.trim()
  const isha = data?.isha?.adhan?.trim()
  const summary = fajr && isha ? ` · Fajr ${fajr} · Isha ${isha}` : ''
  return (
    <span>
      {label}
      {summary}
      {!data?.date && rowNumber != null ? ` #${rowNumber + 1}` : ''}
    </span>
  )
}
