// src/lib/submissions-table.ts
//
// Pure logic for the admin submissions spreadsheet (no React, no fetch):
// schema → column specs, cell value access/formatting, type-aware filter
// predicates, sort comparator, and global search. Unit-tested in
// submissions-table.test.ts; consumed by src/admin/forms/submissions/.

import type { FieldTypeId, FormSchema } from './form-schema'

export type FilterKind = 'text' | 'options' | 'numberRange' | 'dateRange'

export interface ColumnOption {
  value: string
  label: string
}

export interface ColumnSpec {
  /** 'submittedAt' | 'payment' | 'field:<name>' */
  id: string
  label: string
  kind: FilterKind
  /** Set for form-field columns; value lives at row.data[fieldName]. */
  fieldName?: string
  fieldType?: FieldTypeId
  /** Set when kind === 'options'. */
  options?: ColumnOption[]
}

/** Per-column filter UI state. Which keys apply depends on the column's kind. */
export interface ColumnFilterState {
  query?: string
  selected?: string[]
  min?: string
  max?: string
}

export interface SubmissionRowData {
  id: string | number
  submittedAt?: string | null
  paymentStatus?: string | null
  submitterEmail?: string | null
  submitterName?: string | null
  amountCents?: number | null
  currency?: string | null
  stripePaymentIntentId?: string | null
  data?: Record<string, unknown> | null
}

export const PAYMENT_OPTIONS: ColumnOption[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'expired', label: 'Expired' },
  { value: 'na', label: 'Not applicable' },
]

const OPTION_TYPES: ReadonlySet<string> = new Set(['dropdown', 'radio', 'multiselect', 'checkbox-group'])

export function buildColumnSpecs(
  schema: FormSchema | null | undefined,
  opts: { paymentEnabled: boolean },
): ColumnSpec[] {
  const specs: ColumnSpec[] = [{ id: 'submittedAt', label: 'Submitted', kind: 'dateRange' }]

  const fields = (schema?.steps ?? []).flatMap((s) => s.fields)
  for (const f of fields) {
    if (f.type === 'page-break') continue
    const base = { id: `field:${f.name}`, label: f.label, fieldName: f.name, fieldType: f.type }
    if (OPTION_TYPES.has(f.type)) {
      specs.push({ ...base, kind: 'options', options: 'options' in f ? f.options : [] })
    } else if (f.type === 'consent') {
      specs.push({
        ...base,
        kind: 'options',
        options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
      })
    } else if (f.type === 'number') {
      specs.push({ ...base, kind: 'numberRange' })
    } else if (f.type === 'date') {
      specs.push({ ...base, kind: 'dateRange' })
    } else {
      specs.push({ ...base, kind: 'text' })
    }
  }

  if (opts.paymentEnabled) {
    specs.push({ id: 'payment', label: 'Payment', kind: 'options', options: PAYMENT_OPTIONS })
  }
  return specs
}

export function getCellValue(row: SubmissionRowData, spec: ColumnSpec): unknown {
  if (spec.fieldName) return row.data?.[spec.fieldName]
  if (spec.id === 'payment') return row.paymentStatus
  return row.submittedAt
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
}

export function formatCellValue(value: unknown): string {
  if (isEmpty(value)) return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export function formatSubmittedAt(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function toComparable(value: unknown, kind: FilterKind): number | null {
  if (kind === 'numberRange') {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value !== 'string') return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

export function matchesText(value: unknown, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (isEmpty(value)) return false
  return formatCellValue(value).toLowerCase().includes(q)
}

export function matchesOptions(value: unknown, selected: string[]): boolean {
  if (selected.length === 0) return true
  if (isEmpty(value)) return false
  if (Array.isArray(value)) return value.some((v) => selected.includes(String(v)))
  return selected.includes(String(value))
}

const DAY_MS = 86_400_000

export function matchesRange(
  value: unknown,
  state: { min?: string; max?: string },
  kind: FilterKind,
): boolean {
  if (!state.min && !state.max) return true
  const v = toComparable(value, kind)
  if (v === null) return false
  if (state.min) {
    const min = toComparable(state.min, kind)
    if (min !== null && v < min) return false
  }
  if (state.max) {
    let max = toComparable(state.max, kind)
    if (max !== null) {
      // A date-only max like "2026-05-01" should include the whole day.
      if (kind === 'dateRange') max += DAY_MS - 1
      if (v > max) return false
    }
  }
  return true
}

export function matchesFilter(
  value: unknown,
  spec: ColumnSpec,
  state: ColumnFilterState | undefined,
): boolean {
  if (!state) return true
  if (spec.kind === 'text') return matchesText(value, state.query ?? '')
  if (spec.kind === 'options') return matchesOptions(value, state.selected ?? [])
  return matchesRange(value, state, spec.kind)
}

export function isFilterActive(spec: ColumnSpec, state: ColumnFilterState | undefined): boolean {
  if (!state) return false
  if (spec.kind === 'text') return !!state.query?.trim()
  if (spec.kind === 'options') return (state.selected?.length ?? 0) > 0
  return !!state.min || !!state.max
}

export function matchesGlobal(row: SubmissionRowData, specs: ColumnSpec[], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return specs.some((spec) => {
    const value = getCellValue(row, spec)
    return !isEmpty(value) && formatCellValue(value).toLowerCase().includes(q)
  })
}

/** Sort comparator. Empty values always sort last (regardless of direction). */
export function compareValues(a: unknown, b: unknown, spec: ColumnSpec): number {
  const aEmpty = isEmpty(a)
  const bEmpty = isEmpty(b)
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (spec.kind === 'numberRange' || spec.kind === 'dateRange') {
    const av = toComparable(a, spec.kind)
    const bv = toComparable(b, spec.kind)
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return av < bv ? -1 : av > bv ? 1 : 0
  }
  return formatCellValue(a).localeCompare(formatCellValue(b), undefined, {
    sensitivity: 'base',
    numeric: true,
  })
}
