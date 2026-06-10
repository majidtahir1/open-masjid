'use client'

/**
 * SubmissionsTable — TanStack-powered spreadsheet body.
 * Sorting/filtering logic comes from src/lib/submissions-table.ts;
 * TanStack provides the row models and state plumbing.
 */

import { useMemo, useState } from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  compareValues,
  computeSummary,
  formatCellValue,
  formatSubmittedAt,
  getCellValue,
  isFilterActive,
  matchesFilter,
  matchesGlobal,
  type ColumnFilterState,
  type ColumnSpec,
  type SubmissionRowData,
  type SummaryKind,
} from '@/lib/submissions-table'
import ColumnMenu from './ColumnMenu'
import SummaryMenu from './SummaryMenu'

export interface SubmissionsTableProps {
  rows: SubmissionRowData[]
  specs: ColumnSpec[]
  globalQuery: string
  filters: Record<string, ColumnFilterState>
  onFiltersChange: (next: Record<string, ColumnFilterState>) => void
  summaries: Record<string, SummaryKind>
  onSummariesChange: (next: Record<string, SummaryKind>) => void
  onRowClick: (row: SubmissionRowData) => void
}

export default function SubmissionsTable({
  rows,
  specs,
  globalQuery,
  filters,
  onFiltersChange,
  summaries,
  onSummariesChange,
  onRowClick,
}: SubmissionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'submittedAt', desc: true }])

  const specById = useMemo(() => new Map(specs.map((s) => [s.id, s])), [specs])

  const columns = useMemo<ColumnDef<SubmissionRowData>[]>(
    () =>
      specs.map((spec) => ({
        id: spec.id,
        accessorFn: (row) => getCellValue(row, spec),
        filterFn: (tableRow, columnId, filterValue) =>
          matchesFilter(tableRow.getValue(columnId), spec, filterValue as ColumnFilterState),
        sortingFn: (a, b, columnId) => compareValues(a.getValue(columnId), b.getValue(columnId), spec),
      })),
    [specs],
  )

  const columnFilters = useMemo(
    () =>
      Object.entries(filters)
        .filter(([id, state]) => {
          const spec = specById.get(id)
          return spec ? isFilterActive(spec, state) : false
        })
        .map(([id, state]) => ({ id, value: state })),
    [filters, specById],
  )

  // No onColumnFiltersChange on purpose: columnFilters is fully controlled by
  // the parent's `filters` prop (derived in the memo above). Adding a handler
  // would create a second source of truth.
  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is a known incompatible library with React Compiler; safe here as we don't pass memoized values from it to other memoized components
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter: globalQuery },
    onSortingChange: setSorting,
    globalFilterFn: (tableRow, _columnId, q) => matchesGlobal(tableRow.original, specs, String(q ?? '')),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const sortFor = (id: string): 'asc' | 'desc' | null => {
    const s = sorting.find((x) => x.id === id)
    return s ? (s.desc ? 'desc' : 'asc') : null
  }

  const visibleRows = table.getRowModel().rows

  return (
    <div className="sv-table-wrap">
      <table className="sv-table">
        <thead>
          <tr>
            {specs.map((spec) => {
              const dir = sortFor(spec.id)
              return (
                <th
                  key={spec.id}
                  aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                >
                  <div className="sv-th">
                    <span className="sv-th__label">{spec.label}</span>
                    {dir === 'asc' && <ArrowUp size={12} aria-hidden />}
                    {dir === 'desc' && <ArrowDown size={12} aria-hidden />}
                    {isFilterActive(spec, filters[spec.id]) && (
                      <span className="sv-th__filter-dot" title="Filter active" />
                    )}
                    <ColumnMenu
                      spec={spec}
                      sortDir={dir}
                      onSort={(d) => setSorting([{ id: spec.id, desc: d === 'desc' }])}
                      filter={filters[spec.id]}
                      onFilterChange={(state) => onFiltersChange({ ...filters, [spec.id]: state })}
                    />
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((tableRow) => (
            <tr key={String(tableRow.original.id)} onClick={() => onRowClick(tableRow.original)}>
              {tableRow.getVisibleCells().map((cell) => {
                const spec = specById.get(cell.column.id)
                if (!spec) return <td key={cell.id} />
                const value = cell.getValue()
                const text =
                  spec.id === 'submittedAt' ? formatSubmittedAt(value) : formatCellValue(value)
                return (
                  <td
                    key={cell.id}
                    className={spec.fieldType === 'long-text' ? 'sv-td--truncate' : undefined}
                    title={text === '—' ? undefined : text}
                  >
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
          {visibleRows.length === 0 && (
            <tr>
              <td colSpan={specs.length} className="sv-empty">
                No submissions match the current filters.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            {specs.map((spec, i) => {
              if (i === 0) {
                return (
                  <td key={spec.id} className="sv-foot__total">
                    Total {visibleRows.length}
                    {visibleRows.length !== rows.length ? ` of ${rows.length}` : ''}
                  </td>
                )
              }
              const kind = summaries[spec.id] ?? 'none'
              const display =
                kind === 'none'
                  ? ''
                  : computeSummary(visibleRows.map((r) => getCellValue(r.original, spec)), kind)
              return (
                <td key={spec.id}>
                  <SummaryMenu
                    spec={spec}
                    value={kind}
                    display={display}
                    onChange={(k) => onSummariesChange({ ...summaries, [spec.id]: k })}
                  />
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
