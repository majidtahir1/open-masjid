'use client'

import React from 'react'

/**
 * Confirmation section — success message shown after a form is submitted.
 *
 * Note on `settings.successMessage` (richText): This field is a Payload
 * richText (Lexical) field. Editing it inline would require embedding Payload's
 * full Lexical editor component. For v1 simplicity, we defer editing to the
 * main form document view where Payload renders the native rich-text editor.
 */
export default function Confirmation() {
  return (
    <div className="settings-card">
      <h3 className="settings-card__title">Confirmation</h3>

      <p className="settings-field__helper" style={{ marginBottom: 12 }}>
        The success message is a rich-text field.{' '}
        <a href="../" style={{ color: '#1e3a5f', textDecoration: 'underline' }}>
          Edit success message in the main form view
        </a>{' '}
        to use the full editor.
      </p>

      <p className="settings-field__helper">
        The message is displayed on the public form page after a successful submission.
        You can use it to thank the submitter, provide next steps, or share relevant links.
      </p>
    </div>
  )
}
