import type { FormSchema } from './form-schema'

const escape = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return ''
  if (Array.isArray(v)) return escape(v.join('; '))
  if (typeof v === 'boolean') return v ? 'yes' : ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function submissionsToCsv(
  schema: FormSchema,
  submissions: Array<{
    submittedAt: string | Date
    status: string
    paymentStatus: string
    submitterEmail: string
    data: Record<string, unknown>
    amountCents?: number | null
    currency?: string | null
  }>,
): string {
  const fieldCols: Array<{ name: string; label: string }> = []
  for (const step of schema.steps) for (const f of step.fields) {
    if (f.type === 'page-break') continue
    fieldCols.push({ name: f.name, label: f.label })
  }
  const header = ['Submitted at', 'Email', 'Status', 'Payment', 'Amount', 'Currency', ...fieldCols.map((c) => c.label)]
  const rows = submissions.map((s) => [
    escape(new Date(s.submittedAt).toISOString()),
    escape(s.submitterEmail),
    escape(s.status),
    escape(s.paymentStatus),
    escape(s.amountCents != null ? (s.amountCents / 100).toFixed(2) : ''),
    escape(s.currency ?? ''),
    ...fieldCols.map((c) => escape(s.data[c.name])),
  ])
  return [header.map(escape).join(','), ...rows.map((r) => r.join(','))].join('\n')
}
