'use client'

import React, { useState } from 'react'
import { useField } from '@payloadcms/ui'
import { Check, Copy } from 'lucide-react'

const PLACEHOLDER_HOST = '<masjid>.example.org'

export default function EmbedShare() {
  const { value: slug } = useField<string>({ path: 'slug' })
  const [copied, setCopied] = useState(false)

  const slugValue = slug ?? ''
  const publicUrl = `https://${PLACEHOLDER_HOST}/forms/${slugValue || '<slug>'}`

  const embedCode = `<iframe
  src="${publicUrl}"
  width="100%"
  height="600"
  frameborder="0"
  title="Form"
></iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API may be unavailable in some admin environments
    }
  }

  return (
    <div className="settings-card">
      <h3 className="settings-card__title">Embed &amp; share</h3>

      {/* Public URL */}
      <div className="settings-url-row">
        <span className="settings-url-display">{publicUrl}</span>
        <button
          type="button"
          className="settings-btn settings-btn--secondary"
          onClick={handleCopy}
          aria-label="Copy public URL"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Embed code — coming soon */}
      <div className="settings-field">
        <label className="settings-field__label">Embed code</label>
        <p className="settings-field__helper" style={{ marginBottom: 8 }}>
          Embed code — coming soon. Drop this snippet into any page to embed the form.
        </p>
        <textarea
          className="settings-embed-textarea"
          rows={5}
          value={embedCode}
          readOnly
          disabled
          aria-label="Embed code (coming soon)"
        />
      </div>
    </div>
  )
}
