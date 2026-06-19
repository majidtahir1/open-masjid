import { describe, expect, it } from 'vitest'
import type { FormSchema } from './form-schema'
import {
  buildColumnSpecs,
  compareValues,
  computeSummary,
  summaryOptionsFor,
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
  paymentStatus: 'paid',
  submitterEmail: 'a@b.com',
  submitterName: 'Aisha',
  data: { full_name: 'Aisha Khan', email: 'a@b.com', guests: 3, meal: 'veg', days: ['sat', 'sun'], arrival: '2026-05-02', consent: true },
}

describe('buildColumnSpecs', () => {
  it('maps schema fields in order after submittedAt, excluding page breaks', () => {
    const specs = buildColumnSpecs(schema, { paymentEnabled: false })
    expect(specs.map((s) => s.id)).toEqual([
      'submittedAt', 'field:full_name', 'field:email', 'field:guests',
      'field:meal', 'field:days', 'field:arrival', 'field:consent',
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
    expect(buildColumnSpecs(null, { paymentEnabled: false }).map((s) => s.id)).toEqual(['submittedAt'])
  })

  it('expands a repeatable-group into per-item child columns', () => {
    const groupSchema: FormSchema = {
      steps: [
        {
          id: 's1',
          fields: [
            { type: 'short-text', id: 'g1', name: 'guardian', label: 'Guardian', required: false },
            {
              type: 'repeatable-group', id: 'gr', name: 'children', label: 'Children', itemLabel: 'Child',
              max: 2,
              fields: [
                { type: 'short-text', id: 'c1', name: 'child_first', label: 'First', required: false },
                { type: 'number', id: 'c2', name: 'child_grade', label: 'Grade', required: false },
              ],
            },
          ] as FormSchema['steps'][0]['fields'],
        },
      ],
    }
    const specs = buildColumnSpecs(groupSchema, { paymentEnabled: false })
    expect(specs.map((s) => s.id)).toEqual([
      'submittedAt', 'field:guardian',
      'field:children.0.child_first', 'field:children.0.child_grade',
      'field:children.1.child_first', 'field:children.1.child_grade',
    ])
    // Per-item child columns carry the child's filter kind.
    expect(specs.find((s) => s.id === 'field:children.0.child_grade')?.kind).toBe('numberRange')
    expect(specs.find((s) => s.id === 'field:children.0.child_first')?.label).toContain('Child 1')
  })
})

describe('getCellValue', () => {
  const specs = buildColumnSpecs(schema, { paymentEnabled: true })
  const spec = (id: string) => specs.find((s) => s.id === id) as ColumnSpec
  it('reads field columns from data, meta columns from the row', () => {
    expect(getCellValue(row, spec('field:full_name'))).toBe('Aisha Khan')
    expect(getCellValue(row, spec('submittedAt'))).toBe('2026-05-01T14:30:00.000Z')
    expect(getCellValue(row, spec('payment'))).toBe('paid')
  })
  it('returns undefined for missing answers', () => {
    expect(getCellValue({ ...row, data: {} }, spec('field:meal'))).toBeUndefined()
  })

  it('reads nested repeatable-group child values via dotted fieldName', () => {
    const groupRow: SubmissionRowData = {
      id: 'g',
      data: { children: [{ child_first: 'Yusuf', child_grade: 3 }, { child_first: 'Maryam', child_grade: 5 }] },
    }
    const c1: ColumnSpec = { id: 'field:children.0.child_first', label: 'Child 1 — First', kind: 'text', fieldName: 'children.0.child_first' }
    const c2: ColumnSpec = { id: 'field:children.1.child_grade', label: 'Child 2 — Grade', kind: 'numberRange', fieldName: 'children.1.child_grade' }
    const missing: ColumnSpec = { id: 'field:children.5.child_first', label: 'x', kind: 'text', fieldName: 'children.5.child_first' }
    expect(getCellValue(groupRow, c1)).toBe('Yusuf')
    expect(getCellValue(groupRow, c2)).toBe(5)
    expect(getCellValue(groupRow, missing)).toBeUndefined()
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

describe('summaries', () => {
  const num: ColumnSpec = { id: 'n', label: 'N', kind: 'numberRange' }
  const text: ColumnSpec = { id: 't', label: 'T', kind: 'text' }

  it('offers sum/avg only for numeric columns', () => {
    expect(summaryOptionsFor(num)).toEqual(['none', 'sum', 'avg', 'empty', 'filled'])
    expect(summaryOptionsFor(text)).toEqual(['none', 'empty', 'filled'])
  })

  it('sums numeric values, coercing strings and skipping empties', () => {
    expect(computeSummary([1, 2, 4, '3', null, ''], 'sum')).toBe('10')
  })

  it('averages numeric values', () => {
    expect(computeSummary([2, 4], 'avg')).toBe('3')
    expect(computeSummary([1, 1, 5], 'avg')).toBe('2.33')
  })

  it('dashes sum/avg when no numeric values exist', () => {
    expect(computeSummary([null, '', undefined], 'sum')).toBe('—')
    expect(computeSummary([], 'avg')).toBe('—')
  })

  it('counts empty and filled values for any column', () => {
    const values = ['a', '', null, ['x'], [], undefined, 0]
    expect(computeSummary(values, 'empty')).toBe('4')
    expect(computeSummary(values, 'filled')).toBe('3')
  })

  it('returns empty string for none', () => {
    expect(computeSummary([1, 2], 'none')).toBe('')
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
