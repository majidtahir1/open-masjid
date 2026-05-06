/**
 * PublicFormSuccess — shown after a successful submission.
 * Artboard: 5.4 public-success.
 *
 * Shows a branded 76px check circle, a first-name greeting, and an optional
 * monospace receipt strip if the submission was paid.
 * Two action buttons: "Add to calendar" (ghost) and "Back to {masjid}" (primary).
 */
import type { Form } from '@/payload-types'
import { resolveSubmissionMessage } from '@/lib/form-appearance'
import RichText from '@/components/RichText'

interface Receipt {
  id: string | number
  amountCents?: number | null
  currency?: string | null
}

interface Props {
  form: Form
  values: Record<string, unknown>
  receipt?: Receipt
  /** Passed from the thanks page for future use; available to action buttons. */
  formSlug?: string
}

export function PublicFormSuccess({ form, values, receipt }: Props) {
  const rawName = (values.name as string) || (values.email as string) || ''
  const firstName = rawName ? String(rawName).split(' ')[0] : ''

  // Build receipt strip lines
  let receiptLine = ''
  if (receipt && typeof receipt.amountCents === 'number' && receipt.amountCents > 0) {
    const amtStr = `$${(receipt.amountCents / 100).toFixed(2)}`
    const currStr = (receipt.currency ?? 'usd').toUpperCase()
    receiptLine = `Receipt #${receipt.id} · ${amtStr} ${currStr}`
  }

  return (
    <div className="om-pf-card om-pf-success" aria-live="polite" aria-atomic="true">
      {/* 76px brand circle with check mark */}
      <div className="om-pf-success-check" aria-hidden="true">
        ✓
      </div>

      {/* Serif H1 greeting */}
      <h1>
        JazakAllahu khairan{firstName ? `, ${firstName}` : ''}
      </h1>

      {(() => {
        const submissionMsg = resolveSubmissionMessage(form as never)
        return submissionMsg ? (
          <RichText data={submissionMsg as never} />
        ) : (
          <p>{'We received your submission.'}</p>
        )
      })()}

      {/* Monospace receipt strip */}
      {receiptLine && (
        <pre className="om-pf-receipt">{receiptLine}</pre>
      )}

      {/* Action buttons */}
      <div className="om-pf-success-actions">
        <a
          href={`webcal://`}
          className="om-pf-btn-ghost"
          aria-label="Add to calendar"
          style={{ textDecoration: 'none', textAlign: 'center' }}
        >
          Add to calendar
        </a>
        <a
          href="/"
          className="om-pf-btn-primary"
          style={{ textDecoration: 'none', textAlign: 'center' }}
        >
          Back to home
        </a>
      </div>
    </div>
  )
}
