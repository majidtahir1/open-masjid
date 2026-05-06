/**
 * PublicFormSuccess — shown after a successful submission.
 * Artboard: 5.4 public-success.
 *
 * Shows a branded 76px check circle, a first-name greeting, and an optional
 * monospace receipt strip if the submission was paid.
 */
import type { Form } from '@/payload-types'

interface Receipt {
  id: string | number
  amountCents?: number | null
  currency?: string | null
}

interface Props {
  form: Form
  values: Record<string, unknown>
  receipt?: Receipt
}

export function PublicFormSuccess({ form, values, receipt }: Props) {
  const rawName = (values.name as string) || (values.email as string) || ''
  const firstName = rawName ? String(rawName).split(' ')[0] : ''

  return (
    <div className="om-pf-card om-pf-success">
      <div className="om-pf-success-check" aria-hidden="true">
        ✓
      </div>
      <h1>
        JazakAllahu khairan{firstName ? `, ${firstName}` : ''}
      </h1>
      <p>
        {form.settings?.closedMessage
          ? null
          : 'We received your submission.'}
      </p>
      {receipt && typeof receipt.amountCents === 'number' && receipt.amountCents > 0 && (
        <pre className="om-pf-receipt">
          {`Receipt #${receipt.id} · $${(receipt.amountCents / 100).toFixed(2)} ${(receipt.currency ?? 'usd').toUpperCase()}`}
        </pre>
      )}
    </div>
  )
}
