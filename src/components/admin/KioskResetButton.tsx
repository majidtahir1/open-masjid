'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

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
    if (!confirm('Reset pairing? The kiosk will need to be re-paired.')) return
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/kiosk/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kioskId: docId }),
    })
    setBusy(false)
    setMsg(res.ok ? 'Reset — refresh to see new state' : `Error: ${res.status}`)
  }

  if (isNewDoc) return null

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <button onClick={click} disabled={busy} style={{ padding: '0.5rem 1rem' }}>
        {busy ? 'Resetting…' : 'Reset pairing'}
      </button>
      {msg && <span style={{ marginLeft: '0.75rem', opacity: 0.7 }}>{msg}</span>}
    </div>
  )
}
