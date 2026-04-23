'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useState } from 'react'

/**
 * Manual regenerate button for PrayerSchedule.
 *
 * In normal use, the schedule auto-regenerates on save whenever the range or
 * iqamah rules change (see `autoRegeneratePrayerDays` hook). This button
 * exists as an escape hatch for edge cases where a *related* change happens
 * without touching the schedule itself — e.g. the tenant's lat/lng or calc
 * method was corrected, or the admin just wants to force a fresh adhan
 * recompute without editing the schedule.
 *
 * Clicks the `generate-prayer-times` endpoint, which rebuilds days[] from
 * scratch using tenant location + rules.
 */
export default function GenerateTimesButton() {
  const { id, savedDocumentData } = useDocumentInfo()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const daySpan = Array.isArray(
    (savedDocumentData as { days?: unknown[] } | undefined)?.days,
  )
    ? (savedDocumentData as { days: unknown[] }).days.length
    : 0

  async function onRegenerate() {
    if (!id) {
      setMessage('Save the schedule first — generation needs a saved id.')
      return
    }
    if (
      daySpan > 0 &&
      typeof window !== 'undefined' &&
      !window.confirm(
        `This will overwrite ${daySpan} day${daySpan === 1 ? '' : 's'} (adhan + iqamah). Any manual per-day edits will be lost. Continue?`,
      )
    ) {
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/generate-prayer-times', {
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
      } else {
        setMessage(
          `Regenerated ${json.dayCount ?? 0} day(s). Refresh the page to see the new times.`,
        )
      }
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 500,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
    background: 'transparent',
    color: 'var(--theme-elevation-800, #0F1E4A)',
    border: '1px solid var(--theme-elevation-400, #94a3b8)',
    lineHeight: 1.2,
  }

  return (
    <div className="field-type ui-field" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={buttonStyle} onClick={onRegenerate} disabled={busy}>
          {busy ? 'Regenerating…' : 'Force regenerate now'}
        </button>
        {message ? (
          <span style={{ fontSize: 13, color: 'var(--theme-text)' }}>{message}</span>
        ) : null}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--theme-text-light)' }}>
        Days auto-regenerate on save whenever the range or iqamah rules change —
        you usually don't need this button. Use it only to force a fresh recompute
        (e.g. after changing the tenant's location or calculation method).
      </p>
    </div>
  )
}
