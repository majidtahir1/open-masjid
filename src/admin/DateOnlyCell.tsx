'use client'

import React from 'react'

/**
 * Renders a date field in the list view as a date-only string (UTC).
 *
 * Dates are stored as UTC midnight when the picker is `dayOnly`. The default
 * Payload cell renders them in the viewer's local timezone, which shifts the
 * displayed day by one for any viewer west of UTC (e.g. "Apr 30 UTC" shows
 * as "Apr 29 7:00 PM" in US Central). Using UTC keeps the admin's intent.
 */
export default function DateOnlyCell({ cellData }: { cellData?: string | null }) {
  if (!cellData) return <span>—</span>
  try {
    const formatted = new Date(cellData).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
    return <span>{formatted}</span>
  } catch {
    return <span>{cellData.slice(0, 10)}</span>
  }
}
