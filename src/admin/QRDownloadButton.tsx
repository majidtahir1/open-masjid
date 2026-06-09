'use client'

/**
 * QRDownloadButton — Payload v3 custom UI field for the QR Codes collection.
 *
 * The stored `generatedImage` is a fixed 512px PNG meant for kiosk display.
 * Masajid often want a print-quality copy (flyers, banners, signage), so this
 * button regenerates the QR client-side at a chosen high resolution straight
 * from the current form values (target URL + colors) and downloads it — no
 * save required, so it reflects unsaved edits too.
 */

import { useField } from '@payloadcms/ui'
import QRCode from 'qrcode'
import React, { useState } from 'react'

const SIZES = [1024, 2048, 4096] as const
type Size = (typeof SIZES)[number]

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'qr-code'
  )
}

export default function QRDownloadButton() {
  const { value: targetUrl } = useField<string>({ path: 'targetUrl' })
  const { value: fgColor } = useField<string>({ path: 'fgColor' })
  const { value: bgColor } = useField<string>({ path: 'bgColor' })
  const { value: label } = useField<string>({ path: 'label' })

  const [size, setSize] = useState<Size>(2048)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function onDownload() {
    if (!targetUrl) {
      setMessage('Enter a target URL first.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const dataUrl = await QRCode.toDataURL(targetUrl, {
        type: 'image/png',
        color: {
          dark: fgColor || '#000000',
          light: bgColor || '#FFFFFF',
        },
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${slugify(label || 'qr-code')}-${size}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setMessage(`Downloaded ${size}×${size}px PNG.`)
    } catch (err) {
      setMessage((err as Error).message || 'Failed to generate QR code.')
    } finally {
      setBusy(false)
    }
  }

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 500,
    cursor: busy || !targetUrl ? 'not-allowed' : 'pointer',
    opacity: busy || !targetUrl ? 0.6 : 1,
    background: 'transparent',
    color: 'var(--theme-elevation-800, #0F1E4A)',
    border: '1px solid var(--theme-elevation-400, #94a3b8)',
    lineHeight: 1.2,
  }

  const selectStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 4,
    fontSize: 14,
    border: '1px solid var(--theme-elevation-400, #94a3b8)',
    background: 'var(--theme-input-bg, transparent)',
    color: 'var(--theme-elevation-800, #0F1E4A)',
  }

  return (
    <div className="field-type ui-field" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          aria-label="QR download size"
          value={size}
          onChange={(e) => setSize(Number(e.target.value) as Size)}
          disabled={busy}
          style={selectStyle}
        >
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}×{s}px
            </option>
          ))}
        </select>
        <button type="button" style={buttonStyle} onClick={onDownload} disabled={busy || !targetUrl}>
          {busy ? 'Generating…' : 'Download high-res QR (PNG)'}
        </button>
        {message ? (
          <span style={{ fontSize: 13, color: 'var(--theme-text)' }}>{message}</span>
        ) : null}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--theme-text-light)' }}>
        Generates a print-quality copy from the current URL and colors — great for flyers,
        banners, and signage. No save needed; it uses what&apos;s in the form right now.
      </p>
    </div>
  )
}
