'use client'

import type { ColumnFilterState, ColumnSpec, SubmissionRowData } from '@/lib/submissions-table'

export interface SubmissionsTableProps {
  rows: SubmissionRowData[]
  specs: ColumnSpec[]
  globalQuery: string
  filters: Record<string, ColumnFilterState>
  onFiltersChange: (next: Record<string, ColumnFilterState>) => void
  onRowClick: (row: SubmissionRowData) => void
}

export default function SubmissionsTable({ rows }: SubmissionsTableProps) {
  return <div className="sv-state">Table coming in Task 4 — {rows.length} submissions loaded.</div>
}
