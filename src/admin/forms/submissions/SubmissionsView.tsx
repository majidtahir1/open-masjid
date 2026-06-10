'use client'

/**
 * SubmissionsView — the "Submissions" document tab on a form's edit view.
 *
 * Spreadsheet-style table of all submissions for this form: one column per
 * schema field, client-side sort/filter (TanStack), global search, status
 * pills, CSV export, slide-over row detail.
 *
 * Registered in src/collections/Forms.ts under
 * admin.components.views.edit.submissions (path: '/submissions').
 *
 * Spec: docs/superpowers/specs/2026-06-10-submissions-spreadsheet-design.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, Search, X } from 'lucide-react'
import type { FormSchema } from '@/lib/form-schema'
import {
  buildColumnSpecs,
  isFilterActive,
  type ColumnFilterState,
  type SubmissionRowData,
} from '@/lib/submissions-table'
import SubmissionsTable from './SubmissionsTable'
import SubmissionDrawer from './SubmissionDrawer'
import './submissions-view.css'

interface FormDoc {
  id: string | number
  title?: string
  slug?: string
  schema?: FormSchema
  payment?: { enabled?: boolean | null } | null
}

type StatusPill = 'all' | 'new' | 'reviewed' | 'archived'

const PAGE_SIZE = 500
const ROW_CAP = 2000

const STATUS_PILLS: Array<{ id: StatusPill; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'archived', label: 'Archived' },
]

export default function SubmissionsView() {
  // The view renders at /admin/collections/forms/<id>/submissions — the doc
  // id comes from the URL rather than a hook so this works regardless of
  // which providers Payload mounts around custom tab views.
  const pathname = usePathname()
  const formId = useMemo(() => {
    const m = pathname?.match(/\/collections\/forms\/([^/]+)\/submissions/)
    return m ? decodeURIComponent(m[1]) : null
  }, [pathname])

  const [form, setForm] = useState<FormDoc | null>(null)
  const [rows, setRows] = useState<SubmissionRowData[]>([])
  const [capped, setCapped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [globalQuery, setGlobalQuery] = useState('')
  const [statusPill, setStatusPill] = useState<StatusPill>('all')
  const [filters, setFilters] = useState<Record<string, ColumnFilterState>>({})
  const [openRowId, setOpenRowId] = useState<string | number | null>(null)

  useEffect(() => {
    if (!formId) {
      setError('Could not determine the form id from the URL.')
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const formRes = await fetch(`/api/forms/${formId}?depth=0`, { credentials: 'include' })
        if (!formRes.ok) throw new Error(`Failed to load form (HTTP ${formRes.status})`)
        const formDoc = (await formRes.json()) as FormDoc

        const all: SubmissionRowData[] = []
        let page = 1
        let hasMore = false
        for (;;) {
          const qs = new URLSearchParams({
            'where[form][equals]': String(formId),
            limit: String(PAGE_SIZE),
            page: String(page),
            sort: '-submittedAt',
            depth: '0',
          })
          const res = await fetch(`/api/form-submissions?${qs.toString()}`, { credentials: 'include' })
          if (!res.ok) throw new Error(`Failed to load submissions (HTTP ${res.status})`)
          const data = (await res.json()) as { docs?: SubmissionRowData[]; hasNextPage?: boolean }
          all.push(...(data.docs ?? []))
          hasMore = !!data.hasNextPage
          if (!hasMore || all.length >= ROW_CAP) break
          page += 1
        }

        if (!cancelled) {
          setForm(formDoc)
          setRows(all.slice(0, ROW_CAP))
          setCapped(hasMore && all.length >= ROW_CAP)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load submissions')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [formId])

  const specs = useMemo(
    () => buildColumnSpecs(form?.schema ?? null, { paymentEnabled: !!form?.payment?.enabled }),
    [form],
  )

  const pillRows = useMemo(
    () => (statusPill === 'all' ? rows : rows.filter((r) => r.status === statusPill)),
    [rows, statusPill],
  )

  const openRow = useMemo(
    () => (openRowId === null ? null : rows.find((r) => r.id === openRowId) ?? null),
    [rows, openRowId],
  )

  const handleStatusChange = useCallback((id: string | number, status: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }, [])

  const activeFilterCount = specs.filter((s) => isFilterActive(s, filters[s.id])).length

  if (loading) return <div className="sv-state">Loading submissions…</div>
  if (error) return <div className="sv-state sv-state--error">{error}</div>

  return (
    <div className="sv-root">
      <div className="sv-toolbar">
        <div className="sv-search">
          <Search size={14} strokeWidth={1.75} aria-hidden />
          <input
            type="search"
            value={globalQuery}
            onChange={(e) => setGlobalQuery(e.target.value)}
            placeholder="Search submissions…"
            aria-label="Search submissions"
          />
        </div>
        <div className="sv-pills" role="group" aria-label="Filter by status">
          {STATUS_PILLS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`sv-pill${statusPill === p.id ? ' sv-pill--active' : ''}`}
              aria-pressed={statusPill === p.id}
              onClick={() => setStatusPill(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {activeFilterCount > 0 && (
          <button type="button" className="sv-clear" onClick={() => setFilters({})}>
            <X size={12} aria-hidden />
            Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </button>
        )}
        <span className="sv-spacer" />
        {form?.slug && rows.length > 0 && (
          <a className="sv-export" href={`/api/forms/${form.slug}/submissions.csv`} download>
            <Download size={13} strokeWidth={1.75} aria-hidden />
            Download CSV
          </a>
        )}
      </div>

      {capped && (
        <div className="sv-capped">
          Showing the {ROW_CAP} most recent submissions. Use the CSV export for the full data set.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="sv-state">
          No submissions yet. Once people fill out the form, they&rsquo;ll appear here.
        </div>
      ) : (
        <SubmissionsTable
          rows={pillRows}
          specs={specs}
          globalQuery={globalQuery}
          filters={filters}
          onFiltersChange={setFilters}
          onRowClick={(r) => setOpenRowId(r.id)}
        />
      )}

      {openRow && form && (
        <SubmissionDrawer
          row={openRow}
          schema={form.schema ?? null}
          formSlug={form.slug ?? null}
          onClose={() => setOpenRowId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
