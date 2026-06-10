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
