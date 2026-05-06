'use client'

import React, { useState } from 'react'
import { useField } from '@payloadcms/ui'
import { X } from 'lucide-react'

interface EmailEntry {
  email: string
  id?: string
}

export default function Notifications() {
  const { value: emailsRaw, setValue: setEmailsRaw } = useField<EmailEntry[]>({
    path: 'settings.notificationEmails',
  })
  const { value: sendConfirmation, setValue: setSendConfirmation } = useField<boolean>({
    path: 'settings.sendConfirmation',
  })
  const { value: confirmationSubject, setValue: setConfirmationSubject } = useField<string>({
    path: 'settings.confirmationSubject',
  })
  const { value: confirmationBody, setValue: setConfirmationBody } = useField<string>({
    path: 'settings.confirmationBody',
  })

  const [newEmail, setNewEmail] = useState('')

  const emails: EmailEntry[] = Array.isArray(emailsRaw) ? emailsRaw : []
  const notifyEnabled = emails.length > 0

  const addEmail = () => {
    const trimmed = newEmail.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return
    setEmailsRaw([...emails, { email: trimmed }])
    setNewEmail('')
  }

  const removeEmail = (idx: number) => {
    setEmailsRaw(emails.filter((_, i) => i !== idx))
  }

  const handleNewEmailKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addEmail()
    }
  }

  return (
    <div className="settings-card">
      <h3 className="settings-card__title">Notifications</h3>

      {/* Email on every submission */}
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-label">Email me on every submission</div>
          <div className="settings-toggle-desc">
            {notifyEnabled
              ? `Notifications will be sent to ${emails.length} address${emails.length > 1 ? 'es' : ''}`
              : 'Add at least one email address below'}
          </div>
        </div>
        <label className="settings-toggle" aria-label="Notify on submission">
          <input
            type="checkbox"
            checked={notifyEnabled}
            onChange={() => {
              if (notifyEnabled) setEmailsRaw([])
            }}
            readOnly={!notifyEnabled}
          />
          <span className="settings-toggle__track" />
        </label>
      </div>

      {/* Email chip list */}
      {emails.length > 0 && (
        <div className="settings-chips">
          {emails.map((entry, i) => (
            <span key={`${entry.email}-${i}`} className="settings-chip">
              {entry.email}
              <button
                type="button"
                className="settings-chip__remove"
                aria-label={`Remove ${entry.email}`}
                onClick={() => removeEmail(i)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add email */}
      <div className="settings-add-row">
        <input
          type="email"
          className="settings-field__input"
          placeholder="admin@masjid.org"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={handleNewEmailKey}
        />
        <button
          type="button"
          className="settings-btn settings-btn--secondary"
          onClick={addEmail}
          disabled={!newEmail.trim()}
        >
          Add
        </button>
      </div>

      {/* Confirmation email toggle */}
      <div className="settings-toggle-row" style={{ marginTop: 16 }}>
        <div>
          <div className="settings-toggle-label">Send confirmation email to submitter</div>
          <div className="settings-toggle-desc">
            Sends an automatic reply when someone submits the form.
          </div>
        </div>
        <label className="settings-toggle" aria-label="Send confirmation email">
          <input
            type="checkbox"
            checked={!!sendConfirmation}
            onChange={(e) => setSendConfirmation(e.target.checked)}
          />
          <span className="settings-toggle__track" />
        </label>
      </div>

      {/* Confirmation fields — revealed when on */}
      {sendConfirmation && (
        <div className="settings-revealed">
          <div className="settings-field">
            <label className="settings-field__label" htmlFor="conf-subject">
              Subject
            </label>
            <input
              id="conf-subject"
              type="text"
              className="settings-field__input"
              value={confirmationSubject ?? ''}
              onChange={(e) => setConfirmationSubject(e.target.value)}
              placeholder="Thanks for submitting {{form}}"
            />
          </div>
          <div className="settings-field">
            <label className="settings-field__label" htmlFor="conf-body">
              Message body
            </label>
            <textarea
              id="conf-body"
              className="settings-field__textarea"
              value={confirmationBody ?? ''}
              onChange={(e) => setConfirmationBody(e.target.value)}
              placeholder="Hi {{name}}, we received your submission and will be in touch."
              style={{ minHeight: 100 }}
            />
            <span className="settings-field__helper">
              Use <code>{'{{form}}'}</code> and <code>{'{{name}}'}</code> as placeholders.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
