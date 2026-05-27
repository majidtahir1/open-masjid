'use client'

import React, { useState } from 'react'

export default function SalahControlBanner() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const call = async (action: 'start' | 'end') => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/kiosk/salah', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      setMsg(res.ok ? (action === 'start' ? 'Salah screen on.' : 'Returned to rotation.') : 'Action failed.')
    } catch {
      setMsg('Action failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
      <button type="button" disabled={busy} onClick={() => call('start')} className="btn btn--style-primary">
        Salah now
      </button>
      <button type="button" disabled={busy} onClick={() => call('end')} className="btn btn--style-secondary">
        End now
      </button>
      {msg && <span style={{ fontSize: 13, opacity: 0.8 }}>{msg}</span>}
    </div>
  )
}
