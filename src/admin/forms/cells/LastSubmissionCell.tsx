'use client'

import { useEffect, useState } from 'react'
import { fetchSubmissionStats, type FormSubmissionStats } from './submission-stats'
import './submission-cells.css'

interface CellProps {
  rowData?: { id?: string | number }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function LastSubmissionCell({ rowData }: CellProps) {
  const id = rowData?.id
  const [stats, setStats] = useState<FormSubmissionStats | null>(null)

  useEffect(() => {
    if (id == null) return
    let cancelled = false
    fetchSubmissionStats(id)
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch(() => {
        /* leave the placeholder */
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (id == null || (stats && !stats.lastAt)) {
    return <span className="sc-cell sc-cell--muted">—</span>
  }
  if (!stats) return <span className="sc-cell sc-cell--muted">…</span>
  return <span className="sc-cell">{formatDate(stats.lastAt as string)}</span>
}
