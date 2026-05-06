'use client'
/**
 * PublicFormClient — multi-step public form rendering.
 *
 * State: values, errors, currentStep, submitting, success, selectedAmountCents.
 * Handles step-level validation, Back/Continue navigation,
 * and final POST to /api/forms/<slug>/submit.
 *
 * Artboards: 5.1 public-empty, 5.2 public-filled, 5.3 public-multi.
 */
import { useState, type FormEvent } from 'react'
import { PublicFormFields } from '@/components/PublicFormFields'
import { PublicFormProgress } from '@/components/PublicFormProgress'
import { PublicFormSuccess } from '@/components/PublicFormSuccess'
import { PublicFormPaymentBlock } from '@/components/PublicFormPaymentBlock'
import type { Form } from '@/payload-types'
import type { FormSchema } from '@/lib/form-schema'

interface Props {
  form: Form
  closed: boolean
}

export function PublicFormClient({ form, closed }: Props) {
  const schema = form.schema as FormSchema

  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ receipt?: { id: string | number } } | null>(null)
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(null)

  // ─── Closed state ───────────────────────────────────────────────────────────
  if (closed) {
    return (
      <div className="om-pf-card om-pf-closed">
        {form.settings?.closedMessage ?? 'This form is closed. Thank you for your interest.'}
      </div>
    )
  }

  // ─── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <PublicFormSuccess
        form={form}
        values={values}
        receipt={success.receipt}
      />
    )
  }

  const totalSteps = schema.steps.length
  const isLast = step === totalSteps - 1

  // Filter page-break pseudo-fields — they only exist to define step boundaries
  const currentFields = schema.steps[step].fields.filter((f) => f.type !== 'page-break')

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function setValue(name: string, val: unknown) {
    setValues((prev) => ({ ...prev, [name]: val }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function validateStep(): boolean {
    const stepErrors: Record<string, string> = {}
    for (const f of currentFields) {
      const val = values[f.name]
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && (val as unknown[]).length === 0)
      if (f.required && isEmpty) {
        stepErrors[f.name] = 'Required'
      }
    }
    setErrors((prev) => ({ ...prev, ...stepErrors }))

    // Move focus to the first errored field so keyboard/SR users land there
    if (Object.keys(stepErrors).length > 0) {
      const firstErrorName = Object.keys(stepErrors)[0]
      const firstField = currentFields.find((f) => f.name === firstErrorName)
      if (firstField) {
        // Use setTimeout to allow React to flush state + re-render error markup
        setTimeout(() => {
          const el = document.getElementById(`f-${firstField.id}`)
          el?.focus()
        }, 0)
      }
    }

    return Object.keys(stepErrors).length === 0
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validateStep()) return

    // Navigate to next step if not on the last one
    if (!isLast) {
      setStep(step + 1)
      return
    }

    setSubmitting(true)

    // Collect honeypot value from the hidden input
    const formEl = e.currentTarget
    const hpInput = formEl.querySelector<HTMLInputElement>('input[name="_hp"]')
    const hp = hpInput?.value ?? ''

    const body: Record<string, unknown> = { ...values, _hp: hp }

    // Include selected payment amount when present
    if (form.payment?.enabled && selectedAmountCents !== null) {
      body._amount_cents = selectedAmountCents
    }

    let res: Response | null = null
    try {
      res = await fetch(`/api/forms/${form.slug}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      setSubmitting(false)
      setErrors({ _form: 'Network error — please try again.' })
      return
    }

    setSubmitting(false)

    if (res.status === 410) {
      setErrors({ _form: 'This form just closed.' })
      return
    }
    if (res.status === 429) {
      setErrors({ _form: 'Too many attempts — please try again in a minute.' })
      return
    }
    if (res.status === 422) {
      const j = await res.json().catch(() => ({}))
      setErrors(j.fieldErrors ?? { _form: 'Please check the fields above.' })
      return
    }
    if (!res.ok) {
      setErrors({ _form: 'Something went wrong. Please try again.' })
      return
    }

    const j = await res.json().catch(() => ({}))
    if (j.checkoutUrl) {
      window.location.assign(j.checkoutUrl)
      return
    }
    setSuccess({})
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const stepTitle = schema.steps[step].title

  // Derive submit button label
  const baseLabel = form.settings?.submitButtonLabel ?? 'Submit'
  const submitLabel =
    isLast && form.payment?.enabled && selectedAmountCents !== null
      ? `${baseLabel} — $${(selectedAmountCents / 100).toFixed(2)}`
      : isLast
        ? baseLabel
        : 'Continue →'

  // Suggested amounts: extract the `amount` value from each row
  const suggestedAmountsCents =
    form.payment?.suggestedAmountsCents?.map((row) => row.amount) ?? []

  return (
    <form className="om-pf-card" onSubmit={onSubmit} noValidate>
      {totalSteps > 1 && (
        <PublicFormProgress current={step + 1} total={totalSteps} />
      )}
      {stepTitle && (
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
          {stepTitle}
        </h2>
      )}

      <PublicFormFields
        fields={currentFields}
        values={values}
        errors={errors}
        onChange={setValue}
      />

      {/* Payment block — rendered on the last step only when payment is enabled */}
      {isLast && form.payment?.enabled && (
        <PublicFormPaymentBlock
          mode={form.payment.mode ?? 'fixed'}
          priceCents={form.payment.priceCents ?? undefined}
          suggestedAmountsCents={suggestedAmountsCents}
          allowCustomAmount={form.payment.allowCustomAmount ?? false}
          currency={form.payment.currency ?? undefined}
          description={form.payment.description ?? undefined}
          onChange={setSelectedAmountCents}
        />
      )}

      {/* Honeypot — visually hidden, not reachable by keyboard */}
      <input
        type="text"
        name="_hp"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
        }}
      />

      {errors._form && (
        <p className="om-pf-error" role="alert">
          {errors._form}
        </p>
      )}

      <div className="om-pf-actions">
        {step > 0 && (
          <button
            type="button"
            className="om-pf-btn-ghost"
            onClick={() => setStep(step - 1)}
          >
            ← Back
          </button>
        )}
        <button
          type="submit"
          className="om-pf-btn-primary"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Submitting…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
