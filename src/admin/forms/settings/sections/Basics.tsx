'use client'

import React from 'react'
import { useField } from '@payloadcms/ui'

/**
 * Basics section — Form title, slug, and description.
 *
 * Note on `description` (richText): Payload's `useField` returns a Lexical
 * editor state object for richText fields, not a plain string. Rendering a
 * full rich-text editor inline here requires Payload's LexicalRichTextCell /
 * editor components which are not straightforward to embed outside Payload's
 * own cell context. For v1 simplicity we fall back to an "edit in main view"
 * notice — the user can edit it in Payload's default document view.
 */
export default function Basics() {
  const { value: title, setValue: setTitle } = useField<string>({ path: 'title' })
  const { value: slug, setValue: setSlug } = useField<string>({ path: 'slug' })

  const slugValue = slug ?? ''
  const publicUrl = `https://<masjid>.example.org/forms/${slugValue || '<slug>'}`

  return (
    <div className="settings-card">
      <h3 className="settings-card__title">Form basics</h3>

      <div className="settings-grid-2">
        {/* Title */}
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="settings-title">
            Title
          </label>
          <input
            id="settings-title"
            type="text"
            className="settings-field__input"
            value={title ?? ''}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Eid RSVP 2026"
          />
        </div>

        {/* Slug */}
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="settings-slug">
            Slug
          </label>
          <input
            id="settings-slug"
            type="text"
            className="settings-field__input"
            value={slugValue}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. eid-rsvp-2026"
          />
          <span className="settings-field__helper--url">{publicUrl}</span>
        </div>

        {/* Description — richText fallback */}
        <div className="settings-field settings-field--full">
          <label className="settings-field__label">Description</label>
          <p className="settings-field__helper">
            The description is a rich-text field.{' '}
            <a href="../" style={{ color: '#1e3a5f', textDecoration: 'underline' }}>
              Edit in main form view
            </a>
            {' '}to use the full editor.
          </p>
        </div>
      </div>
    </div>
  )
}
