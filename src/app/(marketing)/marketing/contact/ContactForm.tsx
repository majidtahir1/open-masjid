'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { submitContactForm, type ContactFormState } from './actions'

const initialState: ContactFormState | null = null

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="om-btn om-btn-primary om-btn-lg" disabled={pending}>
      {pending ? 'Sending…' : 'Send message'}
    </button>
  )
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState)

  if (state?.ok) {
    return (
      <div className="om-contact-form-success" role="status" aria-live="polite">
        <h3 className="om-h3">Message sent.</h3>
        <p className="om-body">{state.message}</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="om-contact-form" noValidate>
      <div className="om-contact-form-row">
        <label className="om-contact-form-field">
          <span>Your name</span>
          <input type="text" name="name" required autoComplete="name" />
        </label>
        <label className="om-contact-form-field">
          <span>Email</span>
          <input type="email" name="email" required autoComplete="email" />
        </label>
      </div>
      <label className="om-contact-form-field">
        <span>Masjid (optional)</span>
        <input type="text" name="masjid" autoComplete="organization" />
      </label>
      <label className="om-contact-form-field">
        <span>Message</span>
        <textarea name="message" rows={6} required maxLength={5000} />
      </label>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state && !state.ok ? (
        <p className="om-contact-form-error" role="alert">{state.message}</p>
      ) : null}
      <SubmitButton />
    </form>
  )
}
