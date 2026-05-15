'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const styles = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--om-border, #e5e7eb)',
    background: 'transparent',
    color: 'var(--fg2, #374151)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 120ms ease',
  } as React.CSSProperties,
  msg: {
    fontSize: 12,
    color: 'var(--fg3, #6b7280)',
    marginLeft: 12,
  } as React.CSSProperties,
}

export default function KioskResetButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/')
  const kiosksIdx = segments.indexOf('kiosks')
  const docId = kiosksIdx !== -1 ? segments[kiosksIdx + 1] : undefined
  const isNewDoc = !docId || docId === 'create'

  const click = async () => {
    if (!docId || isNewDoc) return
    if (!confirm('Reset pairing? The kiosk will need to be re-paired with a new code.')) return
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/kiosk/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kioskId: docId }),
    })
    setBusy(false)
    setMsg(res.ok ? 'Reset — refresh to see new state' : `Error ${res.status}`)
  }

  if (isNewDoc) return null

  return (
    <span>
      <button onClick={click} disabled={busy} style={{ ...styles.btn, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Resetting…' : 'Reset pairing'}
      </button>
      {msg && <span style={styles.msg}>{msg}</span>}
    </span>
  )
}
