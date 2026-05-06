'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'

export default function SubmissionLimits() {
  const { value: capacity, setValue: setCapacity } = useField<number | null>({
    path: 'settings.capacity',
  })
  const { value: closedMessage, setValue: setClosedMessage } = useField<string>({
    path: 'settings.closedMessage',
  })

  return (
    <div className="settings-card">
      <h3 className="settings-card__title">Submission limits</h3>

      <div className="settings-field" style={{ marginBottom: 16 }}>
        <label className="settings-field__label" htmlFor="settings-capacity">
          Capacity
        </label>
        <input
          id="settings-capacity"
          type="number"
          className="settings-field__input"
          style={{ maxWidth: 160 }}
          min={0}
          value={capacity ?? ''}
          onChange={(e) => {
            const v = e.target.value
            setCapacity(v === '' ? null : parseInt(v, 10))
          }}
          placeholder="No limit"
        />
        <span className="settings-field__helper">
          Maximum number of submissions before the form closes. Leave blank for no limit.
        </span>
      </div>

      <div className="settings-field">
        <label className="settings-field__label" htmlFor="settings-closed-msg">
          Closed message
        </label>
        <textarea
          id="settings-closed-msg"
          className="settings-field__textarea"
          value={closedMessage ?? ''}
          onChange={(e) => setClosedMessage(e.target.value)}
          placeholder="This form is closed. Thank you for your interest."
        />
        <span className="settings-field__helper">
          Shown to visitors when the form is closed or at capacity.
        </span>
      </div>
    </div>
  )
}
