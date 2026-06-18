'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { RULE_IDS } from '../ansari/ruleIds'

/**
 * Rendered inside the Ansari tab on the tenant edit page (Site Settings →
 * Ansari). Lets tenant admins manage Ansari's proactive-nudge preferences
 * inline without the `ansari-settings` collection living in the sidebar (it is
 * hidden from the nav for everyone but platform owners).
 *
 * The settings are still a separate collection — deliberately exempt from the
 * billing lock that wraps the rest of the tenant doc — so this panel reads and
 * writes `/api/ansari-settings` directly rather than piggybacking on the Tenants
 * form. It self-gates to tenant users; kiosk managers never see the tab (gated
 * by the field `condition` in Tenants.ts) and are denied by the collection's
 * access regardless.
 */

type TenantRef = string | number | { id: string | number } | null | undefined

type AnsariSettingsDoc = {
  id: string | number
  enabled?: boolean | null
  disabledRules?: string[] | null
  quietHoursStart?: number | null
  quietHoursEnd?: number | null
  digestDay?: string | null
  digestHour?: number | null
  telegramConnected?: boolean | null
}

type FormState = {
  enabled: boolean
  disabledRules: string[]
  quietHoursStart: number
  quietHoursEnd: number
  digestDay: string
  digestHour: number
}

const DEFAULTS: FormState = {
  enabled: true,
  disabledRules: ['calendar.ramadan', 'events.missing_flyer'],
  quietHoursStart: 21,
  quietHoursEnd: 8,
  digestDay: '0',
  digestHour: 9,
}

const DAY_OPTIONS = [
  { label: 'Sunday', value: '0' },
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
]

function tenantIdOf(t: TenantRef): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && 'id' in t) return t.id
  return t as string | number
}

/** Turn a rule id like `prayer.iqamah_drift` into `Prayer · iqamah drift`. */
function ruleLabel(id: string): string {
  const [group, ...rest] = id.split('.')
  const name = rest.join('.').replace(/_/g, ' ')
  const cap = group.charAt(0).toUpperCase() + group.slice(1)
  return name ? `${cap} · ${name}` : cap
}

function clampHour(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(23, Math.trunc(value)))
}

function fromDoc(doc: AnsariSettingsDoc): FormState {
  return {
    enabled: doc.enabled ?? DEFAULTS.enabled,
    disabledRules: doc.disabledRules ?? DEFAULTS.disabledRules,
    quietHoursStart: doc.quietHoursStart ?? DEFAULTS.quietHoursStart,
    quietHoursEnd: doc.quietHoursEnd ?? DEFAULTS.quietHoursEnd,
    digestDay: doc.digestDay ?? DEFAULTS.digestDay,
    digestHour: doc.digestHour ?? DEFAULTS.digestHour,
  }
}

export default function AnsariSettingsTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [docId, setDocId] = useState<string | number | null>(null)
  const [telegramConnected, setTelegramConnected] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULTS)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const meRes = await fetch('/api/users/me?depth=0', { credentials: 'include' })
        const me = await meRes.json()
        const tenantId = tenantIdOf(me?.user?.tenant)
        if (!tenantId) {
          if (!cancelled) {
            setError('No tenant is associated with your account.')
            setLoading(false)
          }
          return
        }

        const res = await fetch(
          `/api/ansari-settings?where[tenant][equals]=${tenantId}&limit=1&depth=0`,
          { credentials: 'include' },
        )
        const data = await res.json()
        const doc: AnsariSettingsDoc | undefined = data?.docs?.[0]
        if (cancelled) return
        if (doc) {
          setDocId(doc.id)
          setTelegramConnected(Boolean(doc.telegramConnected))
          setForm(fromDoc(doc))
        }
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Could not load Ansari settings. Please try again.')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaved(false)
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const toggleRule = useCallback((id: string) => {
    setSaved(false)
    setForm((prev) => {
      const on = prev.disabledRules.includes(id)
      return {
        ...prev,
        disabledRules: on
          ? prev.disabledRules.filter((r) => r !== id)
          : [...prev.disabledRules, id],
      }
    })
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const url = docId ? `/api/ansari-settings/${docId}` : '/api/ansari-settings'
      const method = docId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // tenant is force-set server-side by the setTenantFromUser hook.
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      const id = body?.doc?.id ?? body?.id
      if (id != null) setDocId(id)
      setSaved(true)
    } catch {
      setError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }, [docId, form])

  if (loading) {
    return (
      <div style={panelStyle}>
        <p style={bodyStyle}>Loading Ansari settings…</p>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <h3 style={headingStyle}>Ansari</h3>
      <p style={bodyStyle}>
        Proactive nudge preferences for this masjid: which nudges are on, quiet
        hours, and the weekly digest slot.
      </p>

      {error ? <p style={errorStyle}>{error}</p> : null}

      <label style={checkboxRowStyle}>
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => update('enabled', e.target.checked)}
        />
        <span style={{ fontWeight: 500 }}>Proactive nudges enabled</span>
      </label>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>Disabled nudge types</legend>
        <p style={hintStyle}>
          Nudge types Ansari will stay silent about (&ldquo;Stop these&rdquo;
          also lands here).
        </p>
        <div style={ruleGridStyle}>
          {RULE_IDS.map((id) => (
            <label key={id} style={ruleRowStyle}>
              <input
                type="checkbox"
                checked={form.disabledRules.includes(id)}
                onChange={() => toggleRule(id)}
              />
              <span>{ruleLabel(id)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div style={rowStyle}>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Quiet from (hour, 0–23)</span>
          <input
            type="number"
            min={0}
            max={23}
            value={form.quietHoursStart}
            onChange={(e) => update('quietHoursStart', clampHour(e.target.valueAsNumber))}
            style={inputStyle}
          />
          <span style={hintStyle}>No immediate nudges from this local hour…</span>
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Quiet until (hour, 0–23)</span>
          <input
            type="number"
            min={0}
            max={23}
            value={form.quietHoursEnd}
            onChange={(e) => update('quietHoursEnd', clampHour(e.target.valueAsNumber))}
            style={inputStyle}
          />
          <span style={hintStyle}>…until this local hour.</span>
        </label>
      </div>

      <div style={rowStyle}>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Weekly digest day</span>
          <select
            value={form.digestDay}
            onChange={(e) => update('digestDay', e.target.value)}
            style={inputStyle}
          >
            {DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>Digest hour (local, 0–23)</span>
          <input
            type="number"
            min={0}
            max={23}
            value={form.digestHour}
            onChange={(e) => update('digestHour', clampHour(e.target.valueAsNumber))}
            style={inputStyle}
          />
        </label>
      </div>

      <p style={hintStyle}>
        Telegram: {telegramConnected ? 'connected' : 'not connected'} (set
        automatically when Hermes binds a Telegram chat to this masjid).
      </p>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={save} disabled={saving} style={buttonStyle}>
          {saving ? 'Saving…' : 'Save Ansari settings'}
        </button>
        {saved ? <span style={savedStyle}>Saved ✓</span> : null}
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = { padding: '12px 0', maxWidth: 720 }
const headingStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 8,
  fontSize: 18,
  fontWeight: 600,
}
const bodyStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 20,
  color: 'var(--theme-elevation-600)',
  fontSize: 14,
  lineHeight: 1.5,
}
const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  marginBottom: 20,
  cursor: 'pointer',
}
const fieldsetStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 4,
  padding: '12px 16px',
  margin: 0,
  marginBottom: 20,
}
const legendStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--theme-elevation-700)',
  padding: '0 6px',
}
const ruleGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 8,
  marginTop: 8,
}
const ruleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  cursor: 'pointer',
}
const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  marginBottom: 20,
  flexWrap: 'wrap',
}
const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flex: '1 1 240px',
}
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--theme-elevation-700)',
}
const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 4,
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
  color: 'var(--theme-elevation-900)',
  fontSize: 14,
}
const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--theme-elevation-500)',
  lineHeight: 1.4,
}
const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 4,
  border: 'none',
  background: 'var(--theme-elevation-800)',
  color: 'var(--theme-elevation-0)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}
const savedStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-success-500, #2e7d32)',
  fontWeight: 500,
}
const errorStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: 13,
  color: 'var(--theme-error-500, #c62828)',
}
