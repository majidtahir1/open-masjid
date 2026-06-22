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
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { PublicFormFields } from '@/components/PublicFormFields'
import { PublicFormProgress } from '@/components/PublicFormProgress'
import { PublicFormSuccess } from '@/components/PublicFormSuccess'
import { PublicFormPaymentBlock } from '@/components/PublicFormPaymentBlock'
import { PublicFormTuitionSummary, type SummaryParticipant } from '@/components/PublicFormTuitionSummary'
import RichText from '@/components/RichText'
import { flattenStepsForOnePerPage } from '@/lib/form-appearance'
import type { DiscountTier } from '@/lib/tuition-pricing'
import type { Form } from '@/payload-types'
import { validateFields } from '@/lib/form-schema'
import type { FormSchema, Field } from '@/lib/form-schema'
import type { Appearance } from '@/lib/form-appearance'
import type { ProgramClass, ProgramPricing } from './page'

/** Augmented Form type that includes the appearance group added in V2. */
type FormWithAppearance = Form & { appearance?: Appearance | null }

interface Props {
  form: Form
  closed: boolean
  /** Active classes of the bound program — options for class-select fields. */
  programClasses?: ProgramClass[]
  /** Program pricing model + per-program tuition; null for non-registration forms. */
  programPricing?: ProgramPricing | null
}

/** First repeatable-group field in the schema (the participant group), if any. */
function findParticipantGroup(schema: FormSchema): Extract<Field, { type: 'repeatable-group' }> | null {
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'repeatable-group') return f
    }
  }
  return null
}

/** Name of the first class-select field within a list of fields, if any. */
function classSelectName(fields: readonly Field[]): string | null {
  for (const f of fields) {
    if (f.type === 'class-select' && 'name' in f) return f.name
  }
  return null
}

export function PublicFormClient({ form, closed, programClasses = [], programPricing = null }: Props) {
  const schema = form.schema as FormSchema
  const formExt = form as FormWithAppearance

  const displayMode = formExt.appearance?.displayMode ?? 'all-at-once'
  const effectiveSchema = displayMode === 'one-per-page'
    ? flattenStepsForOnePerPage(schema)
    : schema

  // Seed an empty item ([{}]) for every repeatable-group so the group renders
  // one item card on load. Flat forms have no groups → empty initial values,
  // exactly as before.
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const step of effectiveSchema.steps) {
      for (const f of step.fields) {
        if (f.type === 'repeatable-group') {
          const count = Math.max(1, f.min ?? 1)
          init[f.name] = Array.from({ length: count }, () => ({}))
        }
      }
    }
    return init
  })
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

  const totalSteps = effectiveSchema.steps.length
  const isLast = step === totalSteps - 1

  // Filter page-break pseudo-fields — they only exist to define step boundaries
  const currentFields = effectiveSchema.steps[step].fields.filter((f) => f.type !== 'page-break')

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

  /** Edit one child field of one item; immutable — replaces the item and the array. */
  function onGroupChange(groupName: string, index: number, childName: string, val: unknown) {
    setValues((prev) => {
      const arr = Array.isArray(prev[groupName]) ? (prev[groupName] as Record<string, unknown>[]) : [{}]
      const nextArr = arr.map((item, i) => (i === index ? { ...item, [childName]: val } : item))
      return { ...prev, [groupName]: nextArr }
    })
    const errKey = `${groupName}.${index}.${childName}`
    if (errors[errKey]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[errKey]
        return next
      })
    }
  }

  function addItem(groupName: string) {
    setValues((prev) => {
      const arr = Array.isArray(prev[groupName]) ? (prev[groupName] as Record<string, unknown>[]) : [{}]
      return { ...prev, [groupName]: [...arr, {}] }
    })
  }

  function removeItem(groupName: string, index: number) {
    setValues((prev) => {
      const arr = Array.isArray(prev[groupName]) ? (prev[groupName] as Record<string, unknown>[]) : [{}]
      return { ...prev, [groupName]: arr.filter((_, i) => i !== index) }
    })
    // Drop any errors keyed to the removed item.
    setErrors((prev) => {
      const next: Record<string, string> = {}
      const removedPrefix = `${groupName}.${index}.`
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(removedPrefix)) next[k] = v
      }
      return next
    })
  }

  function validateStep(): boolean {
    // Reuse the same field validation the server runs at submit, so "Continue"
    // catches format/min/option errors (e.g. a malformed email) on the current
    // step instead of letting them slip through to the final POST.
    const { errors: stepErrors } = validateFields(currentFields, values)
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
      const fieldErrors = (j.fieldErrors ?? {}) as Record<string, string>
      const firstName = Object.keys(fieldErrors)[0]
      if (!firstName) {
        setErrors({ _form: 'Please check the fields above.' })
        return
      }
      setErrors(fieldErrors)
      // The failing field may live on an earlier step than the one the user
      // submitted from — jump there so the inline error is actually visible.
      const targetStep = effectiveSchema.steps.findIndex((s) =>
        s.fields.some((f) => f.type !== 'page-break' && f.name === firstName),
      )
      if (targetStep >= 0 && targetStep !== step) setStep(targetStep)
      const targetField = effectiveSchema.steps[targetStep]?.fields.find((f) => f.name === firstName)
      if (targetField) {
        setTimeout(() => document.getElementById(`f-${targetField.id}`)?.focus(), 0)
      }
      return
    }
    if (res.status === 502) {
      setErrors({ _form: 'Payment could not be started. Please try again in a moment.' })
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

  // ─── Enter key auto-advance (one-per-page mode) ──────────────────────────────

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (displayMode !== 'one-per-page') return
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    if (target.tagName !== 'INPUT') return
    const inputType = (target as HTMLInputElement).type
    const textLikeTypes = ['text', 'email', 'tel', 'number', 'date']
    if (!textLikeTypes.includes(inputType)) return
    if (isLast) return
    e.preventDefault()
    if (validateStep()) setStep(step + 1)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const stepTitle = effectiveSchema.steps[step].title

  // Derive submit button label
  const baseLabel = form.settings?.submitButtonLabel ?? 'Submit'
  const submitLabel =
    isLast && form.payment?.enabled && selectedAmountCents !== null
      ? `${baseLabel} — $${(selectedAmountCents / 100).toFixed(2)}`
      : isLast
        ? baseLabel
        : 'Continue →'

  // Suggested amounts: extract the `amount` value from each row
  const suggestedAmountsCents: number[] =
    form.payment?.suggestedAmountsCents?.map((row) => row.amount).filter((a): a is number => typeof a === 'number') ?? []

  // ─── Registration tuition summary ────────────────────────────────────────────
  // A paid registration form shows a live tuition breakdown (program price ×
  // participants − sibling discounts) instead of the legacy donation block.
  const isRegistration = form.schoolRegistration === true
  const paymentModel = programPricing?.paymentModel ?? 'free'
  const showTuition =
    isRegistration && (paymentModel === 'monthly' || paymentModel === 'one-time') && programPricing !== null

  let tuitionParticipants: SummaryParticipant[] = []
  if (showTuition) {
    const participantModel = form.registration?.participantModel ?? 'self'
    if (participantModel === 'children') {
      const group = findParticipantGroup(effectiveSchema)
      const groupName = group?.name
      const classKey = group ? classSelectName(group.fields) : null
      const items = groupName && Array.isArray(values[groupName]) ? (values[groupName] as Record<string, unknown>[]) : []
      tuitionParticipants = items.map((it, i) => {
        const first = String(it.student_first_name ?? '').trim()
        const last = String(it.student_last_name ?? '').trim()
        const name = `${first} ${last}`.trim()
        const classVal = classKey ? it[classKey] : null
        return { label: name || `Child ${i + 1}`, classId: classVal != null ? String(classVal) : null }
      })
    } else {
      const classKey = classSelectName(effectiveSchema.steps.flatMap((s) => s.fields))
      const first = String(values.student_first_name ?? '').trim()
      const last = String(values.student_last_name ?? '').trim()
      const classVal = classKey ? values[classKey] : null
      tuitionParticipants = [{ label: `${first} ${last}`.trim() || 'Registration', classId: classVal != null ? String(classVal) : null }]
    }
  }

  const classPrices: Record<string, number> = Object.fromEntries(
    programClasses.map((c) => [String(c.id), c.tuitionCents ?? 0]),
  )
  const discountTiers = (programPricing?.tiers ?? []) as DiscountTier[]

  // Determine if current step is a single-field text-like step (for Enter hint)
  const showEnterHint =
    displayMode === 'one-per-page' &&
    !isLast &&
    currentFields.length === 1 &&
    ['text', 'email', 'tel', 'number', 'date'].includes(currentFields[0]?.type ?? '')

  return (
    <form className="om-pf-card" onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate>
      {totalSteps > 1 && (
        <PublicFormProgress current={step + 1} total={totalSteps} />
      )}
      {stepTitle && (
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
          {stepTitle}
        </h2>
      )}

      {step === 0 && formExt.appearance?.introMessage ? (
        <div className="om-pf-intro">
          <RichText data={formExt.appearance.introMessage as never} />
        </div>
      ) : null}

      <PublicFormFields
        fields={currentFields}
        values={values}
        errors={errors}
        onChange={setValue}
        onGroupChange={onGroupChange}
        onGroupAdd={addItem}
        onGroupRemove={removeItem}
        programClasses={programClasses}
      />

      {showEnterHint && (
        <div className="om-pf-enter-hint" aria-hidden="true">Press Enter ↵ to continue</div>
      )}

      {/* Paid registration form: live tuition summary (program price, sibling
          discounts) — the actual charge is recomputed server-side at submit. */}
      {isLast && showTuition && programPricing && (
        <PublicFormTuitionSummary
          paymentModel={paymentModel as 'monthly' | 'one-time'}
          pricingModel={programPricing.pricingModel}
          programTuitionCents={programPricing.tuitionCents ?? 0}
          classPrices={classPrices}
          tiers={discountTiers}
          participants={tuitionParticipants}
          currency={programPricing.currency}
        />
      )}

      {/* Legacy donation/payment block — non-registration forms only. */}
      {isLast && !isRegistration && form.payment?.enabled && (
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

      {/* Honeypot — hidden from real users AND from browser autofill.
          MUST use display:none, not off-screen positioning: Chrome/Android
          autofill happily fills a position:absolute / left:-10000px field but
          skips display:none ones. The old off-screen approach was letting
          Android autofill populate _hp, which tripped the honeypot and made the
          submit 500 (findByID on a non-existent row) — silently dropping real
          submissions. Naive spam bots that fill every input still trip it. */}
      <input
        type="text"
        name="_hp"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: 'none' }}
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
