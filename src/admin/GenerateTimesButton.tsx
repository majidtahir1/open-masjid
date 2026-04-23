'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useState } from 'react'

function confirmOverwrite(count?: number): boolean {
  const msg = count
    ? `This will overwrite ${count} days. Continue?`
    : 'This will overwrite existing day rows. Continue?'
  return typeof window !== 'undefined' && window.confirm(msg)
}

export default function GenerateTimesButton() {
  const { id, savedDocumentData } = useDocumentInfo()
  const [busy, setBusy] = useState<null | 'generate' | 'apply'>(null)
  const [message, setMessage] = useState<string>('')

  const existingDayCount = Array.isArray(
    (savedDocumentData as { days?: unknown[] } | undefined)?.days,
  )
    ? (savedDocumentData as { days: unknown[] }).days.length
    : 0

  async function callEndpoint(path: string) {
    if (!id) {
      setMessage('Save the schedule first — generation needs a saved id.')
      return
    }
    try {
      const res = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: id }),
        credentials: 'include',
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dayCount?: number
        error?: string
      }
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? `Request failed (${res.status})`)
        return
      }
      setMessage(`Done — ${json.dayCount ?? 0} day(s) updated. Refresh to see.`)
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  async function onGenerate() {
    if (existingDayCount > 0 && !confirmOverwrite(existingDayCount)) return
    setBusy('generate')
    setMessage('')
    await callEndpoint('generate-prayer-times')
    setBusy(null)
  }

  async function onApplyIqamah() {
    if (existingDayCount > 0 && !confirmOverwrite(existingDayCount)) return
    setBusy('apply')
    setMessage('')
    await callEndpoint('apply-iqamah-rules')
    setBusy(null)
  }

  return (
    <div className="field-type ui-field" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn--style-primary"
          onClick={onGenerate}
          disabled={busy !== null}
        >
          {busy === 'generate' ? 'Generating…' : 'Generate times'}
        </button>
        <button
          type="button"
          className="btn btn--style-secondary"
          onClick={onApplyIqamah}
          disabled={busy !== null}
        >
          {busy === 'apply' ? 'Applying…' : 'Apply iqamah to range'}
        </button>
        {message ? (
          <span style={{ fontSize: 13, color: 'var(--theme-text)' }}>{message}</span>
        ) : null}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--theme-text-light)' }}>
        Generate fills every day in the range with adhan from tenant coordinates and iqamah from the rules below.
        Apply only rewrites iqamah from rules — preserves existing adhan.
      </p>
    </div>
  )
}
