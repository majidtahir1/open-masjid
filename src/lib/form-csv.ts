import type { FormSchema } from './form-schema'
import { csvCell } from '@/lib/csv'

const escape = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return ''
  if (Array.isArray(v)) return escape(v.join('; '))
  if (typeof v === 'boolean') return v ? 'yes' : ''
  const s = String(v)
  return csvCell(s)
}

// A CSV column resolves a single cell from a submission's flat or nested data.
// Flat fields read data[name]; repeatable-group children are expanded into one
// column per (item index, child field) so nested arrays never render blank or
// as `[object Object]`.
interface CsvCol {
  label: string
  get: (data: Record<string, unknown>) => unknown
}

export function submissionsToCsv(
  schema: FormSchema,
  submissions: Array<{
    submittedAt: string | Date
    paymentStatus: string
    submitterEmail: string
    data: Record<string, unknown>
    amountCents?: number | null
    currency?: string | null
  }>,
  opts?: { includePayment?: boolean },
): string {
  // Payment columns only make sense for forms that take payments.
  const includePayment = opts?.includePayment ?? true
  const fieldCols: CsvCol[] = []
  for (const step of schema.steps) for (const f of step.fields) {
    if (f.type === 'page-break' || f.type === 'section') continue
    if (f.type === 'repeatable-group') {
      // Expand into per-item columns. Item count = max items seen across all
      // submissions, but at least 1 so the columns are never absent entirely.
      const groupName = f.name
      const itemLabel = f.itemLabel || f.label || groupName
      let maxItems = 1
      for (const s of submissions) {
        const items = s.data[groupName]
        if (Array.isArray(items) && items.length > maxItems) maxItems = items.length
      }
      for (let i = 0; i < maxItems; i++) {
        for (const child of f.fields) {
          fieldCols.push({
            label: `${itemLabel} ${i + 1} — ${child.label ?? child.name}`,
            get: (data) => {
              const items = data[groupName]
              const item = Array.isArray(items) ? items[i] : undefined
              return item && typeof item === 'object'
                ? (item as Record<string, unknown>)[child.name]
                : undefined
            },
          })
        }
      }
      continue
    }
    fieldCols.push({ label: f.label ?? f.name, get: (data) => data[f.name] })
  }
  const paymentHeader = includePayment ? ['Payment', 'Amount', 'Currency'] : []
  const header = ['Submitted at', 'Email', ...paymentHeader, ...fieldCols.map((c) => c.label)]
  const rows = submissions.map((s) => [
    escape(new Date(s.submittedAt).toISOString()),
    escape(s.submitterEmail),
    ...(includePayment
      ? [
          escape(s.paymentStatus),
          escape(s.amountCents != null ? (s.amountCents / 100).toFixed(2) : ''),
          escape(s.currency ?? ''),
        ]
      : []),
    ...fieldCols.map((c) => escape(c.get(s.data))),
  ])
  return [header.map(escape).join(','), ...rows.map((r) => r.join(','))].join('\n')
}
