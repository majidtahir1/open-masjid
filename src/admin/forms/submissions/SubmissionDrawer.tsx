'use client'

/**
 * SubmissionDrawer — slide-over detail for one submission.
 * Answers in schema order, payment details, reply mailto,
 * single-row CSV export.
 */

import { useEffect } from 'react'
import { CreditCard, Download, ExternalLink, Mail, X } from 'lucide-react'
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
}: SubmissionDrawerProps) {
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

  const displayName = row.submitterName || row.submitterEmail || 'Submission'
  const pi = row.stripePaymentIntentId

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
