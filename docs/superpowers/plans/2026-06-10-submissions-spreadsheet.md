# Submissions Spreadsheet View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Payload-default submissions list with a spreadsheet view: a "Submissions" tab on each form showing one column per form field, with per-column sort/filter, global search, and a slide-over detail panel.

**Architecture:** A Payload custom document-tab view on the `forms` collection (`admin.components.views.edit.submissions`) renders a client component that fetches the form + all its submissions via the existing tenant-scoped REST API, then sorts/filters client-side with TanStack Table. All pure logic (schema → column specs, value formatting, filter predicates, comparators) lives in `src/lib/submissions-table.ts` and is unit-tested. The Forms list gains "Submissions" and "Last submission" columns via `ui` fields with custom Cell components. The old top-level Form Submissions UI is retired (`admin.hidden: true`; old components deleted).

**Tech Stack:** Payload 3.84 admin (custom views, ui-field Cells, importMap), Next.js 16, React 19, @tanstack/react-table v8, vitest, CSS modules-style plain CSS with Payload theme variables, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-06-10-submissions-spreadsheet-design.md`

---

## Context for the implementer (read first)

- **Repo layout:** Payload collections in `src/collections/`, admin React components in `src/admin/forms/`, pure logic + tests in `src/lib/`. Tests run with `npm test` (vitest run). Lint: `npm run lint`. Typecheck: `npx tsc --noEmit`.
- **Form schema shape** (`src/lib/form-schema.ts`): `{ steps: [{ id, title?, fields: [{ id, name, label, type, required?, options?, min?, max? }] }] }`. Field types: `short-text`, `email`, `phone`, `long-text`, `number`, `date`, `dropdown`, `radio`, `multiselect`, `checkbox-group`, `consent`, `page-break`. `page-break` is a layout pseudo-field — always exclude it.
- **Submission shape** (`src/collections/FormSubmissions.ts`): `{ id, form, tenant, submitterEmail, submitterName, data: Record<string, unknown>, status: 'new'|'reviewed'|'archived', paymentStatus: 'na'|'pending_payment'|'paid'|'expired', amountCents, currency, stripePaymentIntentId, submittedAt, ... }`. `data` is flat, keyed by field `name`.
- **Existing endpoints (reuse, do not modify):**
  - `GET /api/form-submissions?where[form][equals]=<id>&...` — tenant-scoped list (Payload REST).
  - `GET /api/forms/<id>?depth=0` — form doc (title, slug, schema, payment.enabled).
  - `PATCH /api/forms/submissions/<id>/status` body `{ status }` — status updates.
  - `GET /api/forms/<slug>/submissions.csv` — CSV export (supports `?id=` for one row).
- **Custom admin components** are registered by string path (e.g. `'/src/admin/forms/Foo#default'`) in collection configs. After ANY registration change, run `npx payload generate:importmap` to regenerate `src/app/(payload)/admin/importMap.js` and commit it.
- **Dead code alert:** `src/admin/forms/FormEditView.tsx`, `src/admin/forms/SubmissionsTab.tsx`, and `src/admin/forms/form-edit-view.css` are written but registered NOWHERE (verified: no references in importMap or any config). They are an abandoned earlier pass at this same feature. Task 7 deletes them.
- **Styling:** plain CSS files imported by the component, class-prefixed (`sv-` here), using Payload theme variables (`var(--theme-elevation-500)`, `var(--theme-bg)`, `var(--theme-text)`, etc.) so dark/light themes work. Follow `src/admin/forms/submissions.css` for tone.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/submissions-table.ts` | Create | Pure logic: column specs from schema, cell value access/format, filter predicates, comparator, global search |
| `src/lib/submissions-table.test.ts` | Create | Unit tests for the above |
| `src/admin/forms/submissions/SubmissionsView.tsx` | Create | Registered tab view: data fetching, toolbar (search/pills/CSV), state, composes table + drawer |
| `src/admin/forms/submissions/SubmissionsTable.tsx` | Create | TanStack table wiring, header cells, status pills, row click |
| `src/admin/forms/submissions/ColumnMenu.tsx` | Create | "⋮" header menu: sort asc/desc + type-aware filter |
| `src/admin/forms/submissions/SubmissionDrawer.tsx` | Create | Slide-over: answers, status toggle, payment, reply |
| `src/admin/forms/submissions/submissions-view.css` | Create | All styles for view, table, menu, drawer |
| `src/admin/forms/cells/submission-stats.ts` | Create | Client fetch helper with per-form promise cache |
| `src/admin/forms/cells/EmptyField.tsx` | Create | Null Field component so ui fields stay list-only |
| `src/admin/forms/cells/SubmissionsCountCell.tsx` | Create | Forms-list cell: total + "N new" badge |
| `src/admin/forms/cells/LastSubmissionCell.tsx` | Create | Forms-list cell: last submission date |
| `src/admin/forms/cells/submission-cells.css` | Create | Styles for the two cells |
| `src/collections/Forms.ts` | Modify | Register tab view; add two `ui` fields; defaultColumns |
| `src/collections/FormSubmissions.ts` | Modify | `hidden: true`; remove custom components |
| `src/admin/forms/{SubmissionsList.tsx, SubmissionDetail.tsx, submissions.css, submission-detail.css, FormEditView.tsx, SubmissionsTab.tsx, form-edit-view.css}` + `src/admin/forms/cells/{StatusCell.tsx, PaymentStatusCell.tsx}` | Delete | Retired/dead UI |
| `src/app/(payload)/admin/importMap.js` | Regenerate | Via `npx payload generate:importmap` |

---

### Task 1: Add TanStack Table dependency

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install**

```bash
npm install @tanstack/react-table
```

- [ ] **Step 2: Verify it resolved to v8**

Run: `grep '@tanstack/react-table' package.json`
Expected: a line like `"@tanstack/react-table": "^8.21.3"` (any 8.x is fine)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @tanstack/react-table for submissions spreadsheet"
```

---

### Task 2: Pure table logic (`submissions-table.ts`) — TDD

**Files:**
- Create: `src/lib/submissions-table.ts`
- Test: `src/lib/submissions-table.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/submissions-table.test.ts` with exactly:

```ts
import { describe, expect, it } from 'vitest'
import type { FormSchema } from './form-schema'
import {
  buildColumnSpecs,
  compareValues,
  formatCellValue,
  formatSubmittedAt,
  getCellValue,
  isFilterActive,
  matchesFilter,
  matchesGlobal,
  matchesOptions,
  matchesRange,
  matchesText,
  type ColumnSpec,
  type SubmissionRowData,
} from './submissions-table'

const schema: FormSchema = {
  steps: [
    {
      id: 's1',
      fields: [
        { type: 'short-text', id: 'f1', name: 'full_name', label: 'Name', required: true },
        { type: 'email', id: 'f2', name: 'email', label: 'Email', required: true },
        { type: 'number', id: 'f3', name: 'guests', label: 'Guests', required: false, min: 0, max: 10 },
        { type: 'page-break', id: 'pb1', name: 'pb1' },
        {
          type: 'dropdown', id: 'f4', name: 'meal', label: 'Meal', required: false,
          options: [{ value: 'beef', label: 'Beef' }, { value: 'veg', label: 'Vegetarian' }],
        },
        {
          type: 'checkbox-group', id: 'f5', name: 'days', label: 'Days', required: false,
          options: [{ value: 'sat', label: 'Saturday' }, { value: 'sun', label: 'Sunday' }],
        },
        { type: 'date', id: 'f6', name: 'arrival', label: 'Arrival', required: false },
        { type: 'consent', id: 'f7', name: 'consent', label: 'I agree', required: true },
      ],
    },
  ],
}

const row: SubmissionRowData = {
  id: 'sub1',
  submittedAt: '2026-05-01T14:30:00.000Z',
  status: 'new',
  paymentStatus: 'paid',
  submitterEmail: 'a@b.com',
  submitterName: 'Aisha',
  data: { full_name: 'Aisha Khan', email: 'a@b.com', guests: 3, meal: 'veg', days: ['sat', 'sun'], arrival: '2026-05-02', consent: true },
}

describe('buildColumnSpecs', () => {
  it('maps schema fields in order, excluding page breaks, bracketed by submittedAt and status', () => {
    const specs = buildColumnSpecs(schema, { paymentEnabled: false })
    expect(specs.map((s) => s.id)).toEqual([
      'submittedAt', 'field:full_name', 'field:email', 'field:guests',
      'field:meal', 'field:days', 'field:arrival', 'field:consent', 'status',
    ])
  })

  it('assigns type-aware filter kinds', () => {
    const specs = buildColumnSpecs(schema, { paymentEnabled: false })
    const kind = (id: string) => specs.find((s) => s.id === id)?.kind
    expect(kind('submittedAt')).toBe('dateRange')
    expect(kind('field:full_name')).toBe('text')
    expect(kind('field:guests')).toBe('numberRange')
    expect(kind('field:meal')).toBe('options')
    expect(kind('field:days')).toBe('options')
    expect(kind('field:arrival')).toBe('dateRange')
    expect(kind('status')).toBe('options')
  })

  it('gives consent columns Yes/No options', () => {
    const specs = buildColumnSpecs(schema, { paymentEnabled: false })
    const consent = specs.find((s) => s.id === 'field:consent')
    expect(consent?.kind).toBe('options')
    expect(consent?.options).toEqual([{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }])
  })

  it('appends a payment column only when payments are enabled', () => {
    expect(buildColumnSpecs(schema, { paymentEnabled: false }).some((s) => s.id === 'payment')).toBe(false)
    const specs = buildColumnSpecs(schema, { paymentEnabled: true })
    expect(specs[specs.length - 1].id).toBe('payment')
  })

  it('handles a null schema (meta columns only)', () => {
    expect(buildColumnSpecs(null, { paymentEnabled: false }).map((s) => s.id)).toEqual(['submittedAt', 'status'])
  })
})

describe('getCellValue', () => {
  const specs = buildColumnSpecs(schema, { paymentEnabled: true })
  const spec = (id: string) => specs.find((s) => s.id === id) as ColumnSpec
  it('reads field columns from data, meta columns from the row', () => {
    expect(getCellValue(row, spec('field:full_name'))).toBe('Aisha Khan')
    expect(getCellValue(row, spec('submittedAt'))).toBe('2026-05-01T14:30:00.000Z')
    expect(getCellValue(row, spec('status'))).toBe('new')
    expect(getCellValue(row, spec('payment'))).toBe('paid')
  })
  it('returns undefined for missing answers', () => {
    expect(getCellValue({ ...row, data: {} }, spec('field:meal'))).toBeUndefined()
  })
})

describe('formatCellValue', () => {
  it('formats empties, arrays, and booleans', () => {
    expect(formatCellValue(null)).toBe('—')
    expect(formatCellValue(undefined)).toBe('—')
    expect(formatCellValue('')).toBe('—')
    expect(formatCellValue([])).toBe('—')
    expect(formatCellValue(['sat', 'sun'])).toBe('sat, sun')
    expect(formatCellValue(true)).toBe('Yes')
    expect(formatCellValue(false)).toBe('No')
    expect(formatCellValue(3)).toBe('3')
    expect(formatCellValue('hello')).toBe('hello')
  })
})

describe('formatSubmittedAt', () => {
  it('formats ISO datetimes and dashes invalid input', () => {
    expect(formatSubmittedAt('not-a-date')).toBe('—')
    expect(formatSubmittedAt(null)).toBe('—')
    expect(formatSubmittedAt('2026-05-01T14:30:00.000Z')).toContain('2026')
  })
})

describe('filter predicates', () => {
  it('matchesText is case-insensitive contains; empty query passes', () => {
    expect(matchesText('Aisha Khan', 'khan')).toBe(true)
    expect(matchesText('Aisha Khan', 'zubair')).toBe(false)
    expect(matchesText('Aisha Khan', '')).toBe(true)
    expect(matchesText(null, 'x')).toBe(false)
  })

  it('matchesOptions handles scalars, arrays, booleans, empties', () => {
    expect(matchesOptions('veg', ['veg'])).toBe(true)
    expect(matchesOptions('beef', ['veg'])).toBe(false)
    expect(matchesOptions(['sat', 'sun'], ['sun'])).toBe(true)
    expect(matchesOptions(['sat'], ['sun'])).toBe(false)
    expect(matchesOptions(true, ['true'])).toBe(true)
    expect(matchesOptions(undefined, ['veg'])).toBe(false)
    expect(matchesOptions('veg', [])).toBe(true) // nothing selected = no filter
  })

  it('matchesRange compares numbers', () => {
    expect(matchesRange(3, { min: '2', max: '5' }, 'numberRange')).toBe(true)
    expect(matchesRange(1, { min: '2' }, 'numberRange')).toBe(false)
    expect(matchesRange(9, { max: '5' }, 'numberRange')).toBe(false)
    expect(matchesRange(3, {}, 'numberRange')).toBe(true)
    expect(matchesRange(undefined, { min: '1' }, 'numberRange')).toBe(false)
  })

  it('matchesRange compares dates with an inclusive max day', () => {
    const ts = '2026-05-01T14:30:00.000Z'
    expect(matchesRange(ts, { min: '2026-05-01', max: '2026-05-01' }, 'dateRange')).toBe(true)
    expect(matchesRange(ts, { min: '2026-05-02' }, 'dateRange')).toBe(false)
    expect(matchesRange(ts, { max: '2026-04-30' }, 'dateRange')).toBe(false)
  })

  it('matchesFilter dispatches on spec kind and passes when state is empty', () => {
    const text: ColumnSpec = { id: 'field:full_name', label: 'Name', kind: 'text', fieldName: 'full_name' }
    expect(matchesFilter('Aisha', text, { query: 'ai' })).toBe(true)
    expect(matchesFilter('Aisha', text, undefined)).toBe(true)
  })

  it('isFilterActive detects non-empty filter state', () => {
    const text: ColumnSpec = { id: 'a', label: 'A', kind: 'text' }
    const opts: ColumnSpec = { id: 'b', label: 'B', kind: 'options', options: [] }
    const range: ColumnSpec = { id: 'c', label: 'C', kind: 'numberRange' }
    expect(isFilterActive(text, { query: ' ' })).toBe(false)
    expect(isFilterActive(text, { query: 'x' })).toBe(true)
    expect(isFilterActive(opts, { selected: [] })).toBe(false)
    expect(isFilterActive(opts, { selected: ['v'] })).toBe(true)
    expect(isFilterActive(range, { min: '1' })).toBe(true)
    expect(isFilterActive(range, undefined)).toBe(false)
  })
})

describe('matchesGlobal', () => {
  const specs = buildColumnSpecs(schema, { paymentEnabled: false })
  it('matches any column, case-insensitive', () => {
    expect(matchesGlobal(row, specs, 'aisha')).toBe(true)
    expect(matchesGlobal(row, specs, 'sat, sun')).toBe(true)
    expect(matchesGlobal(row, specs, 'zzz')).toBe(false)
    expect(matchesGlobal(row, specs, '')).toBe(true)
  })
})

describe('compareValues', () => {
  const num: ColumnSpec = { id: 'n', label: 'N', kind: 'numberRange' }
  const date: ColumnSpec = { id: 'd', label: 'D', kind: 'dateRange' }
  const text: ColumnSpec = { id: 't', label: 'T', kind: 'text' }
  it('sorts numbers numerically', () => {
    expect(compareValues(2, 10, num)).toBeLessThan(0)
    expect(compareValues(10, 2, num)).toBeGreaterThan(0)
  })
  it('sorts dates chronologically', () => {
    expect(compareValues('2026-04-30T00:00:00Z', '2026-05-01T00:00:00Z', date)).toBeLessThan(0)
  })
  it('sorts text case-insensitively with numeric awareness', () => {
    expect(compareValues('apple', 'Banana', text)).toBeLessThan(0)
    expect(compareValues('item2', 'item10', text)).toBeLessThan(0)
  })
  it('sorts empty values last', () => {
    expect(compareValues(undefined, 'a', text)).toBeGreaterThan(0)
    expect(compareValues('a', null, text)).toBeLessThan(0)
    expect(compareValues(null, undefined, text)).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/submissions-table.test.ts`
Expected: FAIL — `Cannot find module './submissions-table'` (or similar resolution error)

- [ ] **Step 3: Write the implementation**

Create `src/lib/submissions-table.ts` with exactly:

```ts
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
  /** 'submittedAt' | 'status' | 'payment' | 'field:<name>' */
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
  status?: string | null
  paymentStatus?: string | null
  submitterEmail?: string | null
  submitterName?: string | null
  amountCents?: number | null
  currency?: string | null
  stripePaymentIntentId?: string | null
  data?: Record<string, unknown> | null
}

export const STATUS_OPTIONS: ColumnOption[] = [
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'archived', label: 'Archived' },
]

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

  specs.push({ id: 'status', label: 'Status', kind: 'options', options: STATUS_OPTIONS })
  if (opts.paymentEnabled) {
    specs.push({ id: 'payment', label: 'Payment', kind: 'options', options: PAYMENT_OPTIONS })
  }
  return specs
}

export function getCellValue(row: SubmissionRowData, spec: ColumnSpec): unknown {
  if (spec.fieldName) return row.data?.[spec.fieldName]
  if (spec.id === 'status') return row.status
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/submissions-table.test.ts`
Expected: PASS, all tests green

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors (warnings in unrelated files are fine)

- [ ] **Step 6: Commit**

```bash
git add src/lib/submissions-table.ts src/lib/submissions-table.test.ts
git commit -m "feat(submissions): pure column/filter/sort logic for spreadsheet view"
```

---

### Task 3: Register the Submissions tab view with data loading

**Files:**
- Create: `src/admin/forms/submissions/SubmissionsView.tsx`
- Create: `src/admin/forms/submissions/submissions-view.css`
- Modify: `src/collections/Forms.ts` (add `views` under `admin.components`)
- Regenerate: `src/app/(payload)/admin/importMap.js`

Note: this task references `SubmissionsTable` and `SubmissionDrawer`, created in Tasks 4 and 5. To keep each task compilable, this task creates minimal stub files for both that Tasks 4/5 replace wholesale.

- [ ] **Step 1: Create the view component**

Create `src/admin/forms/submissions/SubmissionsView.tsx` with exactly:

```tsx
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
```

- [ ] **Step 2: Create compilable stubs for the table and drawer**

Create `src/admin/forms/submissions/SubmissionsTable.tsx` (replaced in Task 4):

```tsx
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
```

Create `src/admin/forms/submissions/SubmissionDrawer.tsx` (replaced in Task 5):

```tsx
'use client'

import type { FormSchema } from '@/lib/form-schema'
import type { SubmissionRowData } from '@/lib/submissions-table'

export interface SubmissionDrawerProps {
  row: SubmissionRowData
  schema: FormSchema | null
  formSlug: string | null
  onClose: () => void
  onStatusChange: (id: string | number, status: string) => void
}

export default function SubmissionDrawer(_props: SubmissionDrawerProps) {
  return null
}
```

- [ ] **Step 3: Create the stylesheet**

Create `src/admin/forms/submissions/submissions-view.css` with exactly:

```css
/* ==========================================================================
   SubmissionsView — spreadsheet tab styles (sv-*) + drawer (svd-*)
   Uses Payload theme variables so dark/light both work.
   ========================================================================== */

.sv-root {
  padding: 16px 24px 40px;
}

.sv-state {
  padding: 48px 24px;
  text-align: center;
  font-size: 13.5px;
  color: var(--theme-elevation-500);
}

.sv-state--error {
  color: var(--theme-error-500, #d4584c);
}

/* --- Toolbar ------------------------------------------------------------ */

.sv-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.sv-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 32px;
  min-width: 220px;
  border: 1px solid var(--theme-elevation-150);
  border-radius: 6px;
  background: var(--theme-input-bg, var(--theme-elevation-0));
  color: var(--theme-elevation-500);
}

.sv-search input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--theme-text);
  width: 180px;
}

.sv-pills {
  display: flex;
  gap: 4px;
}

.sv-pill {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--theme-elevation-150);
  border-radius: 999px;
  background: transparent;
  color: var(--theme-elevation-650);
  font-size: 12.5px;
  cursor: pointer;
}

.sv-pill--active {
  background: var(--theme-elevation-800);
  border-color: var(--theme-elevation-800);
  color: var(--theme-elevation-0);
}

.sv-clear {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: 1px dashed var(--theme-elevation-250);
  border-radius: 999px;
  background: transparent;
  color: var(--theme-elevation-650);
  font-size: 12px;
  cursor: pointer;
}

.sv-spacer {
  flex: 1;
}

.sv-export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--theme-elevation-150);
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--theme-text);
  text-decoration: none;
}

.sv-export:hover {
  background: var(--theme-elevation-50);
}

.sv-capped {
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--theme-warning-100, #fdf4e3);
  color: var(--theme-warning-750, #8a6116);
  font-size: 12.5px;
}

/* --- Table -------------------------------------------------------------- */

.sv-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--theme-elevation-100);
  border-radius: 8px;
}

.sv-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

.sv-table th,
.sv-table td {
  border-bottom: 1px solid var(--theme-elevation-100);
  border-right: 1px solid var(--theme-elevation-50);
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-table th {
  background: var(--theme-elevation-50);
  font-weight: 600;
  font-size: 12px;
  color: var(--theme-elevation-650);
  position: sticky;
  top: 0;
  z-index: 1;
}

.sv-table tbody tr {
  cursor: pointer;
}

.sv-table tbody tr:hover {
  background: var(--theme-elevation-50);
}

.sv-th {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sv-th__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-th__filter-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--theme-success-500, #2e7d4f);
  flex: none;
}

.sv-td--truncate {
  max-width: 240px;
}

.sv-empty {
  text-align: center;
  color: var(--theme-elevation-500);
  padding: 24px !important;
  cursor: default;
}

/* --- Status / payment pills --------------------------------------------- */

.sv-status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  text-transform: capitalize;
}

.sv-status--new {
  background: rgba(45, 156, 145, 0.14);
  color: #2d9c91;
}

.sv-status--reviewed {
  background: var(--theme-elevation-100);
  color: var(--theme-elevation-650);
}

.sv-status--archived {
  background: var(--theme-elevation-50);
  color: var(--theme-elevation-450);
}

/* --- Column menu ---------------------------------------------------------- */

.sv-menu {
  position: relative;
  margin-left: auto;
  flex: none;
}

.sv-menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--theme-elevation-450);
  cursor: pointer;
}

.sv-menu__trigger:hover {
  background: var(--theme-elevation-100);
  color: var(--theme-text);
}

.sv-menu__pop {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 200px;
  padding: 6px;
  border: 1px solid var(--theme-elevation-150);
  border-radius: 8px;
  background: var(--theme-input-bg, var(--theme-elevation-0));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  font-weight: 400;
  text-transform: none;
}

.sv-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--theme-text);
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
}

.sv-menu__item:hover {
  background: var(--theme-elevation-50);
}

.sv-menu__item--active {
  background: var(--theme-elevation-100);
}

.sv-menu__divider {
  height: 1px;
  margin: 6px 2px;
  background: var(--theme-elevation-100);
}

.sv-menu__filter {
  padding: 4px 8px 8px;
}

.sv-menu__filter-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--theme-elevation-450);
  margin-bottom: 6px;
}

.sv-menu__filter input[type='text'],
.sv-menu__filter input[type='number'],
.sv-menu__filter input[type='date'] {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--theme-elevation-150);
  border-radius: 5px;
  background: var(--theme-input-bg, var(--theme-elevation-0));
  color: var(--theme-text);
  font-size: 12.5px;
}

.sv-menu__options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}

.sv-menu__option {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--theme-text);
  cursor: pointer;
  white-space: normal;
}

.sv-menu__range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sv-menu__range span {
  color: var(--theme-elevation-450);
}

/* --- Slide-over drawer ---------------------------------------------------- */

.svd-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: flex-end;
}

.svd-panel {
  width: min(440px, 92vw);
  height: 100%;
  overflow-y: auto;
  background: var(--theme-bg);
  color: var(--theme-text);
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.22);
  padding: 20px 22px 32px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.svd-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.svd-header__text h2 {
  margin: 0 0 4px;
  font-size: 17px;
}

.svd-header__meta {
  font-size: 12px;
  color: var(--theme-elevation-500);
}

.svd-close {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--theme-elevation-500);
  cursor: pointer;
  padding: 4px;
  border-radius: 5px;
}

.svd-close:hover {
  background: var(--theme-elevation-100);
}

.svd-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.svd-error {
  font-size: 12px;
  color: var(--theme-error-500, #d4584c);
}

.svd-section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--theme-elevation-450);
  margin: 0 0 8px;
}

.svd-answers {
  display: grid;
  grid-template-columns: minmax(110px, 38%) 1fr;
  gap: 0;
  border: 1px solid var(--theme-elevation-100);
  border-radius: 8px;
  overflow: hidden;
}

.svd-answers dt,
.svd-answers dd {
  margin: 0;
  padding: 9px 12px;
  font-size: 12.5px;
  border-bottom: 1px solid var(--theme-elevation-100);
}

.svd-answers dt {
  color: var(--theme-elevation-500);
  background: var(--theme-elevation-50);
}

.svd-answers dd {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Each dt/dd pair sits in a display:contents wrapper div. */
.svd-answers > div:last-child dt,
.svd-answers > div:last-child dd {
  border-bottom: none;
}

.svd-payment {
  border: 1px solid var(--theme-elevation-100);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12.5px;
}

.svd-payment__amount {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
}

.svd-payment a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  color: var(--theme-text);
  font-size: 12px;
}

.svd-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.svd-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 13px;
  border: 1px solid var(--theme-elevation-150);
  border-radius: 6px;
  background: transparent;
  color: var(--theme-text);
  font-size: 12.5px;
  cursor: pointer;
  text-decoration: none;
}

.svd-btn:hover {
  background: var(--theme-elevation-50);
}

.svd-btn--primary {
  background: var(--theme-elevation-800);
  border-color: var(--theme-elevation-800);
  color: var(--theme-elevation-0);
}

.svd-btn--primary:hover {
  background: var(--theme-elevation-700);
}

.svd-btn[disabled] {
  opacity: 0.6;
  cursor: default;
}
```

- [ ] **Step 4: Register the tab on the Forms collection**

In `src/collections/Forms.ts`, replace:

```ts
  admin: {
    enableListViewSelectAPI: true,
    group: 'Forms',
    hidden: hideForKioskManager,
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'submissionsCount', 'updatedAt'],
  },
```

with:

```ts
  admin: {
    enableListViewSelectAPI: true,
    group: 'Forms',
    hidden: hideForKioskManager,
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'submissionsCount', 'updatedAt'],
    components: {
      views: {
        edit: {
          // Spreadsheet of this form's submissions.
          // Spec: docs/superpowers/specs/2026-06-10-submissions-spreadsheet-design.md
          submissions: {
            Component: '/src/admin/forms/submissions/SubmissionsView#default',
            path: '/submissions',
            tab: {
              label: 'Submissions',
              href: '/submissions',
            },
          },
        },
      },
    },
  },
```

- [ ] **Step 5: Regenerate the importMap**

Run: `npx payload generate:importmap`
Expected: exits 0; `git diff src/app/\(payload\)/admin/importMap.js` shows a new import for `SubmissionsView`

- [ ] **Step 6: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Smoke-test in the dev server**

Run: `npm run dev` (background), wait for ready, then log into `/admin`, open any form, and confirm:
- A "Submissions" tab appears next to "Edit" on the form document
- Clicking it routes to `/admin/collections/forms/<id>/submissions` and shows either "No submissions yet…" or "Table coming in Task 4 — N submissions loaded."

Stop the dev server afterwards. If the tab does not appear, re-check Step 4 key/path and that the importMap was regenerated.

- [ ] **Step 8: Commit**

```bash
git add src/collections/Forms.ts src/admin/forms/submissions/ "src/app/(payload)/admin/importMap.js"
git commit -m "feat(submissions): register Submissions tab view on forms with data loading"
```

---

### Task 4: Spreadsheet table + column menus

**Files:**
- Replace: `src/admin/forms/submissions/SubmissionsTable.tsx`
- Create: `src/admin/forms/submissions/ColumnMenu.tsx`

- [ ] **Step 1: Create the column menu**

Create `src/admin/forms/submissions/ColumnMenu.tsx` with exactly:

```tsx
'use client'

/**
 * ColumnMenu — the "⋮" menu on each spreadsheet column header.
 * Sort ascending / descending + a type-aware filter
 * (text contains, option checklist, or min–max range).
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, MoreVertical } from 'lucide-react'
import type { ColumnFilterState, ColumnSpec } from '@/lib/submissions-table'

interface Props {
  spec: ColumnSpec
  sortDir: 'asc' | 'desc' | null
  onSort: (dir: 'asc' | 'desc') => void
  filter: ColumnFilterState | undefined
  onFilterChange: (state: ColumnFilterState) => void
}

export default function ColumnMenu({ spec, sortDir, onSort, filter, onFilterChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleOption = (value: string) => {
    const selected = filter?.selected ?? []
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    onFilterChange({ ...filter, selected: next })
  }

  const rangeInputType = spec.kind === 'numberRange' ? 'number' : 'date'

  return (
    <div className="sv-menu" ref={rootRef}>
      <button
        type="button"
        className="sv-menu__trigger"
        aria-label={`Column options for ${spec.label}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <MoreVertical size={13} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="sv-menu__pop" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`sv-menu__item${sortDir === 'asc' ? ' sv-menu__item--active' : ''}`}
            onClick={() => {
              onSort('asc')
              setOpen(false)
            }}
          >
            <ArrowUp size={13} aria-hidden />
            Sort ascending
          </button>
          <button
            type="button"
            className={`sv-menu__item${sortDir === 'desc' ? ' sv-menu__item--active' : ''}`}
            onClick={() => {
              onSort('desc')
              setOpen(false)
            }}
          >
            <ArrowDown size={13} aria-hidden />
            Sort descending
          </button>
          <div className="sv-menu__divider" />
          <div className="sv-menu__filter">
            <div className="sv-menu__filter-label">Filter</div>
            {spec.kind === 'text' && (
              <input
                type="text"
                value={filter?.query ?? ''}
                placeholder="Contains…"
                aria-label={`Filter ${spec.label}`}
                onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
              />
            )}
            {spec.kind === 'options' && (
              <div className="sv-menu__options">
                {(spec.options ?? []).map((o) => (
                  <label key={o.value} className="sv-menu__option">
                    <input
                      type="checkbox"
                      checked={(filter?.selected ?? []).includes(o.value)}
                      onChange={() => toggleOption(o.value)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )}
            {(spec.kind === 'numberRange' || spec.kind === 'dateRange') && (
              <div className="sv-menu__range">
                <input
                  type={rangeInputType}
                  value={filter?.min ?? ''}
                  aria-label={`${spec.label} minimum`}
                  onChange={(e) => onFilterChange({ ...filter, min: e.target.value })}
                />
                <span>–</span>
                <input
                  type={rangeInputType}
                  value={filter?.max ?? ''}
                  aria-label={`${spec.label} maximum`}
                  onChange={(e) => onFilterChange({ ...filter, max: e.target.value })}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace the table stub with the TanStack implementation**

Replace the entire contents of `src/admin/forms/submissions/SubmissionsTable.tsx` with:

```tsx
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
  formatCellValue,
  formatSubmittedAt,
  getCellValue,
  isFilterActive,
  matchesFilter,
  matchesGlobal,
  type ColumnFilterState,
  type ColumnSpec,
  type SubmissionRowData,
} from '@/lib/submissions-table'
import ColumnMenu from './ColumnMenu'

export interface SubmissionsTableProps {
  rows: SubmissionRowData[]
  specs: ColumnSpec[]
  globalQuery: string
  filters: Record<string, ColumnFilterState>
  onFiltersChange: (next: Record<string, ColumnFilterState>) => void
  onRowClick: (row: SubmissionRowData) => void
}

export default function SubmissionsTable({
  rows,
  specs,
  globalQuery,
  filters,
  onFiltersChange,
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
                if (spec.id === 'status') {
                  return (
                    <td key={cell.id}>
                      <span className={`sv-status sv-status--${String(value ?? 'new')}`}>
                        {formatCellValue(value)}
                      </span>
                    </td>
                  )
                }
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
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Lint + typecheck + tests**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass

- [ ] **Step 4: Smoke-test in the dev server**

With `npm run dev`: open a form with submissions → Submissions tab. Confirm:
- One column per form field plus Submitted/Status (Payment only on payment forms), newest first
- Column "⋮" → Sort ascending/descending reorders rows; arrow shows in header
- Type-aware filters work (text contains, option checkboxes, min–max) and show the green dot + toolbar "Clear N filters"
- Global search and status pills narrow rows

- [ ] **Step 5: Commit**

```bash
git add src/admin/forms/submissions/SubmissionsTable.tsx src/admin/forms/submissions/ColumnMenu.tsx
git commit -m "feat(submissions): spreadsheet table with sortable, filterable columns"
```

---

### Task 5: Slide-over detail drawer

**Files:**
- Replace: `src/admin/forms/submissions/SubmissionDrawer.tsx`

- [ ] **Step 1: Replace the drawer stub**

Replace the entire contents of `src/admin/forms/submissions/SubmissionDrawer.tsx` with:

```tsx
'use client'

/**
 * SubmissionDrawer — slide-over detail for one submission.
 * Answers in schema order, status toggle (existing PATCH endpoint),
 * payment details, reply mailto, single-row CSV export.
 */

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, CreditCard, Download, ExternalLink, Mail, X } from 'lucide-react'
import type { FormSchema } from '@/lib/form-schema'
import {
  formatCellValue,
  formatSubmittedAt,
  type SubmissionRowData,
} from '@/lib/submissions-table'

export interface SubmissionDrawerProps {
  row: SubmissionRowData
  schema: FormSchema | null
  formSlug: string | null
  onClose: () => void
  onStatusChange: (id: string | number, status: string) => void
}

function formatAmount(cents: number, currency: string | null | undefined): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: (currency ?? 'usd').toUpperCase(),
  }).format(cents / 100)
}

export default function SubmissionDrawer({
  row,
  schema,
  formSlug,
  onClose,
  onStatusChange,
}: SubmissionDrawerProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const fields = (schema?.steps ?? [])
    .flatMap((s) => s.fields)
    .filter((f) => f.type !== 'page-break')

  const status = row.status ?? 'new'
  const displayName = row.submitterName || row.submitterEmail || 'Submission'
  const pi = row.stripePaymentIntentId

  const toggleStatus = useCallback(async () => {
    const next = status === 'reviewed' ? 'new' : 'reviewed'
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/forms/submissions/${row.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Failed to update status')
        return
      }
      onStatusChange(row.id, next)
    } catch {
      setError('Network error — try again')
    } finally {
      setSaving(false)
    }
  }, [row.id, status, onStatusChange])

  return (
    <div className="svd-overlay" onClick={onClose}>
      <aside
        className="svd-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Submission from ${displayName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="svd-header">
          <div className="svd-header__text">
            <h2>{displayName}</h2>
            <div className="svd-header__meta">
              {formatSubmittedAt(row.submittedAt)}
              {row.submitterEmail ? ` · ${row.submitterEmail}` : ''}
            </div>
          </div>
          <button type="button" className="svd-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="svd-status-row">
          <span className={`sv-status sv-status--${status}`}>{status}</span>
          <button
            type="button"
            className={`svd-btn${status === 'reviewed' ? '' : ' svd-btn--primary'}`}
            onClick={toggleStatus}
            disabled={saving}
          >
            <CheckCircle size={14} aria-hidden />
            {saving ? 'Saving…' : status === 'reviewed' ? 'Mark as new' : 'Mark reviewed'}
          </button>
          {error && <span className="svd-error">{error}</span>}
        </div>

        <div>
          <h3 className="svd-section-title">Answers</h3>
          {fields.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>
              Form schema not available.
            </p>
          ) : (
            <dl className="svd-answers">
              {fields.map((f) => (
                <div key={f.id} style={{ display: 'contents' }}>
                  <dt>{f.label}</dt>
                  <dd>{formatCellValue(row.data?.[f.name])}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {row.paymentStatus && row.paymentStatus !== 'na' && (
          <div>
            <h3 className="svd-section-title">
              <CreditCard size={12} aria-hidden style={{ verticalAlign: '-2px', marginRight: 5 }} />
              Payment
            </h3>
            <div className="svd-payment">
              {row.amountCents != null && (
                <div className="svd-payment__amount">
                  {formatAmount(row.amountCents, row.currency)}
                </div>
              )}
              <div>Status: {row.paymentStatus.replace('_', ' ')}</div>
              {pi && (
                <a
                  href={`https://dashboard.stripe.com/payments/${pi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={12} aria-hidden />
                  View in Stripe
                </a>
              )}
            </div>
          </div>
        )}

        <div className="svd-actions">
          {row.submitterEmail && (
            <a className="svd-btn" href={`mailto:${row.submitterEmail}`}>
              <Mail size={14} aria-hidden />
              Reply
            </a>
          )}
          {formSlug && (
            <a
              className="svd-btn"
              href={`/api/forms/${formSlug}/submissions.csv?id=${row.id}`}
              download
            >
              <Download size={14} aria-hidden />
              Export row
            </a>
          )}
        </div>
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: Lint + typecheck + tests**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass

- [ ] **Step 3: Smoke-test in the dev server**

With `npm run dev`: open a form's Submissions tab and click a row. Confirm:
- Drawer slides in from the right; table stays put behind the overlay
- All answers shown with labels; Esc / overlay click / × closes it
- "Mark reviewed" flips the pill in BOTH drawer and table row without a reload
- Payment block appears only for paid/pending submissions; Reply opens mail client

- [ ] **Step 4: Commit**

```bash
git add src/admin/forms/submissions/SubmissionDrawer.tsx
git commit -m "feat(submissions): slide-over detail drawer with status toggle"
```

---

### Task 6: Forms list stat columns

**Files:**
- Create: `src/admin/forms/cells/submission-stats.ts`
- Create: `src/admin/forms/cells/EmptyField.tsx`
- Create: `src/admin/forms/cells/SubmissionsCountCell.tsx`
- Create: `src/admin/forms/cells/LastSubmissionCell.tsx`
- Create: `src/admin/forms/cells/submission-cells.css`
- Modify: `src/collections/Forms.ts` (two `ui` fields + defaultColumns)
- Regenerate: `src/app/(payload)/admin/importMap.js`

Design note: these stats are fetched client-side per row (2 requests per form, deduplicated via a shared promise cache) instead of via virtual-field afterRead hooks. Hooks would run on EVERY form read — including public form-page renders — and add count queries to visitor traffic; cells only run in the admin list view.

- [ ] **Step 1: Create the shared stats fetcher**

Create `src/admin/forms/cells/submission-stats.ts` with exactly:

```ts
/**
 * Client-side submission stats for the Forms list view, with a per-form
 * promise cache so the two cells on each row share the same two requests.
 * Cache lives for the SPA session; a full page refresh re-fetches.
 */

export interface FormSubmissionStats {
  total: number
  newCount: number
  lastAt: string | null
}

interface ListResponse {
  totalDocs?: number
  docs?: Array<{ submittedAt?: string | null }>
}

const cache = new Map<string, Promise<FormSubmissionStats>>()

export function fetchSubmissionStats(formId: string | number): Promise<FormSubmissionStats> {
  const key = String(formId)
  const hit = cache.get(key)
  if (hit) return hit

  const promise = (async (): Promise<FormSubmissionStats> => {
    const base = `/api/form-submissions?where[form][equals]=${encodeURIComponent(key)}&depth=0`
    const [latestRes, newRes] = await Promise.all([
      fetch(`${base}&limit=1&sort=-submittedAt`, { credentials: 'include' }),
      fetch(`${base}&where[status][equals]=new&limit=0`, { credentials: 'include' }),
    ])
    if (!latestRes.ok || !newRes.ok) throw new Error('Failed to load submission stats')
    const latest = (await latestRes.json()) as ListResponse
    const newOnly = (await newRes.json()) as ListResponse
    return {
      total: latest.totalDocs ?? 0,
      newCount: newOnly.totalDocs ?? 0,
      lastAt: latest.docs?.[0]?.submittedAt ?? null,
    }
  })()

  cache.set(key, promise)
  promise.catch(() => cache.delete(key))
  return promise
}
```

- [ ] **Step 2: Create the empty edit-view field component**

Payload renders `ui` fields inside the document edit view too. These two are list-only,
so their `Field` component renders nothing.

Create `src/admin/forms/cells/EmptyField.tsx`:

```tsx
'use client'

/** Field component for list-only ui fields — renders nothing in the edit view. */
export default function EmptyField() {
  return null
}
```

- [ ] **Step 3: Create the two cells and their stylesheet**

Create `src/admin/forms/cells/submission-cells.css`:

```css
/* Cells for the Forms list view: submission count + last submission date. */

.sc-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.sc-cell--muted {
  color: var(--theme-elevation-450);
}

.sc-cell__badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(45, 156, 145, 0.14);
  color: #2d9c91;
}
```

Create `src/admin/forms/cells/SubmissionsCountCell.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { fetchSubmissionStats, type FormSubmissionStats } from './submission-stats'
import './submission-cells.css'

interface CellProps {
  rowData?: { id?: string | number }
}

export default function SubmissionsCountCell({ rowData }: CellProps) {
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

  if (id == null) return <span className="sc-cell sc-cell--muted">—</span>
  if (!stats) return <span className="sc-cell sc-cell--muted">…</span>
  return (
    <span className="sc-cell">
      {stats.total}
      {stats.newCount > 0 && <span className="sc-cell__badge">{stats.newCount} new</span>}
    </span>
  )
}
```

Create `src/admin/forms/cells/LastSubmissionCell.tsx`:

```tsx
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
```

- [ ] **Step 4: Add the ui fields to the Forms collection**

In `src/collections/Forms.ts`:

(a) Update `defaultColumns` (inside the `admin` block changed in Task 3) to:

```ts
    defaultColumns: ['title', 'status', 'submissionsCount', 'lastSubmission', 'updatedAt'],
```

(b) In the `fields` array, immediately AFTER the `status` field's closing `},` and BEFORE the `description` field, insert:

```ts
    {
      name: 'submissionsCount',
      type: 'ui',
      label: 'Submissions',
      admin: {
        components: {
          Field: '/src/admin/forms/cells/EmptyField#default',
          Cell: '/src/admin/forms/cells/SubmissionsCountCell#default',
        },
      },
    },
    {
      name: 'lastSubmission',
      type: 'ui',
      label: 'Last submission',
      admin: {
        components: {
          Field: '/src/admin/forms/cells/EmptyField#default',
          Cell: '/src/admin/forms/cells/LastSubmissionCell#default',
        },
      },
    },
```

- [ ] **Step 5: Regenerate the importMap**

Run: `npx payload generate:importmap`
Expected: importMap gains entries for `SubmissionsCountCell`, `LastSubmissionCell`, and `EmptyField`

- [ ] **Step 6: Lint + typecheck + tests**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass

- [ ] **Step 7: Smoke-test in the dev server**

With `npm run dev`: open `/admin/collections/forms`. Confirm:
- "Submissions" column shows counts, with a teal "N new" badge where new submissions exist
- "Last submission" column shows a date or "—"
- Forms edit views and the public form page still render normally

- [ ] **Step 8: Commit**

```bash
git add src/collections/Forms.ts src/admin/forms/cells/ "src/app/(payload)/admin/importMap.js"
git commit -m "feat(forms): submission count and last-submission columns on the forms list"
```

---

### Task 7: Retire the old submissions UI and dead code

**Files:**
- Modify: `src/collections/FormSubmissions.ts`
- Delete: `src/admin/forms/SubmissionsList.tsx`, `src/admin/forms/SubmissionDetail.tsx`, `src/admin/forms/submissions.css`, `src/admin/forms/submission-detail.css`, `src/admin/forms/cells/StatusCell.tsx`, `src/admin/forms/cells/PaymentStatusCell.tsx`, `src/admin/forms/FormEditView.tsx`, `src/admin/forms/SubmissionsTab.tsx`, `src/admin/forms/form-edit-view.css`
- Regenerate: `src/app/(payload)/admin/importMap.js`

Background: `FormEditView.tsx` / `SubmissionsTab.tsx` / `form-edit-view.css` are an unwired earlier pass at a form edit view (verified: zero references outside themselves). `StatusCell` / `PaymentStatusCell` only serve the form-submissions list view, which this task hides. It was verified (grep) that nothing else in `src/` links to `/admin/collections/form-submissions`.

- [ ] **Step 1: Hide the collection and drop its custom admin components**

In `src/collections/FormSubmissions.ts`, replace:

```ts
import type { CollectionConfig } from 'payload'
import { tenantScopedRead } from '../access/tenantScoped'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'

export const FormSubmissions: CollectionConfig = {
  slug: 'form-submissions',
  labels: { singular: 'Submission', plural: 'Submissions' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Forms',
    hidden: hideForKioskManager,
    useAsTitle: 'submitterEmail',
    defaultColumns: ['submittedAt', 'submitterEmail', 'form', 'status', 'paymentStatus'],
    description: 'Form submissions. Read-only — created by the public submit endpoint.',
    components: {
      beforeListTable: ['/src/admin/forms/SubmissionsList#default'],
      views: {
        edit: {
          // Replace the default edit view with a bespoke submission-detail layout.
          // Artboard ref: 4.2 sub-detail
          default: {
            Component: '/src/admin/forms/SubmissionDetail#default',
          },
        },
      },
    },
  },
```

with:

```ts
import type { CollectionConfig } from 'payload'
import { tenantScopedRead } from '../access/tenantScoped'
import { denyKioskManager } from '../access/kioskRoles'

export const FormSubmissions: CollectionConfig = {
  slug: 'form-submissions',
  labels: { singular: 'Submission', plural: 'Submissions' },
  admin: {
    // No admin UI of its own — submissions are viewed via the spreadsheet
    // "Submissions" tab on each form (src/admin/forms/submissions/). The
    // REST API and access control below are unaffected by `hidden`.
    hidden: true,
    useAsTitle: 'submitterEmail',
    description: 'Form submissions. Read-only — created by the public submit endpoint.',
  },
```

Then remove the two Cell component registrations from the fields. Replace:

```ts
      admin: {
        components: {
          Cell: '/src/admin/forms/cells/StatusCell#default',
        },
      },
```

(on the `status` field) with nothing — i.e. the `status` field becomes:

```ts
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      required: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Archived', value: 'archived' },
      ],
    },
```

and replace the `paymentStatus` field's admin block:

```ts
      admin: {
        readOnly: true,
        components: {
          Cell: '/src/admin/forms/cells/PaymentStatusCell#default',
        },
      },
```

with:

```ts
      admin: { readOnly: true },
```

- [ ] **Step 2: Delete the retired files**

```bash
git rm src/admin/forms/SubmissionsList.tsx \
       src/admin/forms/SubmissionDetail.tsx \
       src/admin/forms/submissions.css \
       src/admin/forms/submission-detail.css \
       src/admin/forms/cells/StatusCell.tsx \
       src/admin/forms/cells/PaymentStatusCell.tsx \
       src/admin/forms/FormEditView.tsx \
       src/admin/forms/SubmissionsTab.tsx \
       src/admin/forms/form-edit-view.css
```

- [ ] **Step 3: Regenerate the importMap**

Run: `npx payload generate:importmap`
Expected: the `SubmissionsList`, `SubmissionDetail`, `StatusCell`, `PaymentStatusCell` imports disappear from `src/app/(payload)/admin/importMap.js`

- [ ] **Step 4: Lint + typecheck + tests**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass — if anything still imports a deleted file, fix the import (there should be none)

- [ ] **Step 5: Smoke-test in the dev server**

With `npm run dev`, confirm:
- "Submissions" no longer appears in the admin sidebar; "Forms" still does
- The Forms list, the form edit view, and the Submissions tab all still work
- A public form page (`/forms/<slug>` on a tenant host) still renders and submits

- [ ] **Step 6: Commit**

```bash
git add -A src/collections/FormSubmissions.ts src/admin/forms "src/app/(payload)/admin/importMap.js"
git commit -m "refactor(submissions): retire top-level submissions UI in favor of the form tab"
```

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test + lint + typecheck**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all green

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: compiles with no type errors (this also exercises the admin bundle including the importMap)

- [ ] **Step 3: End-to-end manual pass (dev server)**

Walk the whole flow once: Forms list (counts + last-submission columns) → open form → Submissions tab → sort two different columns asc/desc → apply a text filter + an options filter together → global search → status pills → open drawer → mark reviewed (pill updates in table) → Export CSV downloads → Esc closes drawer.

- [ ] **Step 4: Commit any fixes, then hand off for review**

Use superpowers:finishing-a-development-branch (or open a PR to `main`) once everything passes.
