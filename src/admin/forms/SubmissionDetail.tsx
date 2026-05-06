'use client'

/**
 * SubmissionDetail — custom edit-view for `form-submissions` documents.
 *
 * Artboard ref: 4.2 sub-detail
 *
 * Layout:
 *   Header: back link | submitter name H1 | timestamp + ID | action buttons
 *   Body (2-col grid):
 *     Left  — Answers card (2-col grid: label | answer)
 *     Right — Status card + Payment card (stacked)
 */

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useDocumentInfo } from '@payloadcms/ui'
import { ChevronLeft, Mail, Download, CheckCircle, CreditCard, ExternalLink } from 'lucide-react'
import type { FormSchema } from '@/lib/form-schema'
import './submission-detail.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmissionDoc {
  id: string | number
  submitterName?: string | null
  submitterEmail?: string | null
  submittedAt?: string | Date | null
  status?: 'new' | 'reviewed' | 'archived' | null
  paymentStatus?: 'na' | 'pending_payment' | 'paid' | 'expired' | null
  amountCents?: number | null
  currency?: string | null
  stripePaymentIntentId?: string | null
  userAgent?: string | null
  ipHash?: string | null
  data?: Record<string, unknown> | null
  form?: {
    id: string | number
    slug?: string
    schema?: FormSchema
    title?: string
  } | string | number | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatAmount(cents: number, currency = 'usd'): string {
  const dollars = cents / 100
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(dollars)
}

function truncateHex(s: string, len = 8): string {
  if (s.length <= len) return s
  return s.slice(0, len) + '…'
}

function getFormSchema(form: SubmissionDoc['form']): FormSchema | null {
  if (!form || typeof form !== 'object') return null
  const f = form as { schema?: FormSchema }
  return f.schema ?? null
}

function getFormSlug(form: SubmissionDoc['form']): string | null {
  if (!form || typeof form !== 'object') return null
  const f = form as { slug?: string }
  return f.slug ?? null
}

function getFormTitle(form: SubmissionDoc['form']): string | null {
  if (!form || typeof form !== 'object') return null
  const f = form as { title?: string }
  return f.title ?? null
}

function renderAnswer(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="sd-answers__empty">—</span>
  }
  if (Array.isArray(value)) {
    return value.join('; ') || <span className="sd-answers__empty">—</span>
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`sd-status-pill sd-status-pill--${status}`}>
      {status}
    </span>
  )
}

function AnswersCard({
  schema,
  data,
}: {
  schema: FormSchema | null
  data: Record<string, unknown> | null | undefined
}) {
  const d = data ?? {}

  if (!schema) {
    return (
      <div className="sd-card">
        <div className="sd-card__header">Answers</div>
        <div className="sd-card__body">
          <p style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>
            Form schema not available.
          </p>
        </div>
      </div>
    )
  }

  const fields = schema.steps.flatMap((s) => s.fields).filter((f) => f.type !== 'page-break')

  return (
    <div className="sd-card">
      <div className="sd-card__header">Answers</div>
      <div className="sd-card__body" style={{ padding: '0 20px' }}>
        <div className="sd-answers">
          {fields.map((f) => (
            <>
              <div key={`${f.id}-label`} className="sd-answers__label">{f.label}</div>
              <div key={`${f.id}-value`} className="sd-answers__value">{renderAnswer(d[f.name])}</div>
            </>
          ))}
          {fields.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '12px 0', fontSize: 13, color: 'var(--theme-elevation-500)' }}>
              No fields in schema.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusCard({ doc }: { doc: SubmissionDoc }) {
  return (
    <div className="sd-card">
      <div className="sd-card__header">Status</div>
      <div className="sd-card__body">
        <StatusPill status={doc.status ?? 'new'} />
        <div className="sd-meta-rows">
          <div className="sd-meta-row">
            <span className="sd-meta-row__label">Submitted</span>
            <span className="sd-meta-row__value">{formatTs(doc.submittedAt)}</span>
          </div>
          <div className="sd-meta-row">
            <span className="sd-meta-row__label">Submitter email</span>
            <span className="sd-meta-row__value">{doc.submitterEmail ?? '—'}</span>
          </div>
          {doc.ipHash && (
            <div className="sd-meta-row">
              <span className="sd-meta-row__label">IP hash</span>
              <span className="sd-meta-row__value sd-meta-row__value--mono" title={doc.ipHash}>
                {truncateHex(doc.ipHash)}
              </span>
            </div>
          )}
          {doc.userAgent && (
            <div className="sd-meta-row">
              <span className="sd-meta-row__label">User agent</span>
              <span className="sd-meta-row__value" title={doc.userAgent} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.userAgent}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PaymentCard({ doc }: { doc: SubmissionDoc }) {
  if (!doc.paymentStatus || doc.paymentStatus === 'na') return null

  const pi = doc.stripePaymentIntentId
  const stripeUrl = pi ? `https://dashboard.stripe.com/payments/${pi}` : null

  return (
    <div className="sd-card">
      <div className="sd-card__header">
        <span className="sd-payment-header">
          <CreditCard size={13} strokeWidth={2} />
          Payment
        </span>
      </div>
      <div className="sd-card__body">
        {doc.amountCents != null && (
          <div className="sd-amount">
            {formatAmount(doc.amountCents, doc.currency ?? 'usd')}
          </div>
        )}
        <div className="sd-meta-rows">
          <div className="sd-meta-row">
            <span className="sd-meta-row__label">Status</span>
            <span className="sd-meta-row__value">{doc.paymentStatus}</span>
          </div>
          <div className="sd-meta-row">
            <span className="sd-meta-row__label">Last 4</span>
            <span className="sd-meta-row__value">—</span>
          </div>
          {pi && (
            <div className="sd-meta-row">
              <span className="sd-meta-row__label">Payment Intent</span>
              <span className="sd-meta-row__value sd-meta-row__value--mono" title={pi}>
                {truncateHex(pi, 16)}
              </span>
            </div>
          )}
        </div>
        {stripeUrl && (
          <a
            href={stripeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sd-stripe-link"
          >
            <ExternalLink size={12} />
            View in Stripe
          </a>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

type ToastState = { message: string; type: 'success' | 'error' } | null

function Toast({ state }: { state: ToastState }) {
  if (!state) return null
  return (
    <div className={`sd-toast sd-toast--${state.type}`}>
      {state.message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SubmissionDetail() {
  const docInfo = useDocumentInfo()
  // Payload v3: doc data is on docInfo.doc (populated document)
  const doc = (docInfo as { doc?: SubmissionDoc }).doc ?? null

  const [currentStatus, setCurrentStatus] = useState<string | null>(null)
  const [toastState, setToastState] = useState<ToastState>(null)

  const status = currentStatus ?? doc?.status ?? 'new'
  const formSlug = doc ? getFormSlug(doc.form) : null
  const formTitle = doc ? getFormTitle(doc.form) : null
  const schema = doc ? getFormSchema(doc.form) : null
  const submissionId = doc?.id

  // Build the back-link href — go to the form-submissions list
  const backHref = '/admin/collections/form-submissions'

  const displayName = doc?.submitterName || doc?.submitterEmail || 'Submission'

  // Export link (bulk CSV endpoint; pass ?id= for future filter support)
  const exportHref = formSlug && submissionId
    ? `/api/forms/${formSlug}/submissions.csv?id=${submissionId}`
    : null

  // Reply mailto link
  const replyHref = doc?.submitterEmail
    ? `mailto:${doc.submitterEmail}`
    : null

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToastState({ message, type })
    setTimeout(() => setToastState(null), 3000)
  }, [])

  const handleMarkReviewed = useCallback(async () => {
    if (!submissionId) return
    const nextStatus = status === 'reviewed' ? 'new' : 'reviewed'
    try {
      const res = await fetch(`/api/forms/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        showToast(body.error ?? 'Failed to update status', 'error')
        return
      }
      setCurrentStatus(nextStatus)
      showToast(
        nextStatus === 'reviewed' ? 'Marked as reviewed' : 'Marked as new',
        'success',
      )
    } catch {
      showToast('Network error — try again', 'error')
    }
  }, [submissionId, status, showToast])

  if (!doc) {
    return (
      <div className="sd-root">
        <p style={{ color: 'var(--theme-elevation-500)', fontSize: 14 }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="sd-root">
      {/* Back link */}
      <Link href={backHref} className="sd-back">
        <ChevronLeft size={14} strokeWidth={1.75} />
        <span>Back to Submissions</span>
      </Link>

      {/* Header */}
      <div className="sd-header">
        <div className="sd-header__left">
          <h1>{displayName}</h1>
          <div className="sd-header__meta">
            {formatTs(doc.submittedAt)}
            {submissionId && (
              <span style={{ marginLeft: 12, opacity: 0.7 }}>ID: {submissionId}</span>
            )}
            {formTitle && (
              <span style={{ marginLeft: 12, opacity: 0.7 }}>Form: {formTitle}</span>
            )}
          </div>
        </div>

        <div className="sd-header__actions">
          {replyHref && (
            <a href={replyHref} className="sd-btn sd-btn--ghost">
              <Mail size={14} />
              Reply
            </a>
          )}
          {exportHref && (
            <a href={exportHref} download className="sd-btn sd-btn--ghost">
              <Download size={14} />
              Export
            </a>
          )}
          <button
            type="button"
            className={`sd-btn ${status === 'reviewed' ? 'sd-btn--ghost' : 'sd-btn--success'}`}
            onClick={handleMarkReviewed}
          >
            <CheckCircle size={14} />
            {status === 'reviewed' ? 'Mark as new' : 'Mark reviewed'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="sd-body">
        {/* Left — Answers */}
        <AnswersCard schema={schema} data={doc.data} />

        {/* Right — Side cards */}
        <div className="sd-sidebar">
          <StatusCard doc={{ ...doc, status: status as SubmissionDoc['status'] }} />
          <PaymentCard doc={doc} />
        </div>
      </div>

      <Toast state={toastState} />
    </div>
  )
}
