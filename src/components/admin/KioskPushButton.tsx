'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

export default function KioskPushButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Derive the kiosk document id from the URL: /admin/collections/kiosks/<id>
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/')
  const kiosksIdx = segments.indexOf('kiosks')
  const docId = kiosksIdx !== -1 ? segments[kiosksIdx + 1] : undefined
  const isNewDoc = !docId || docId === 'create'

  const click = async () => {
    if (!docId || isNewDoc) return
    setBusy(true)
    setMsg(null)
    const res = await fetch(`/api/kiosk/push?documentId=${encodeURIComponent(docId)}`, {
      method: 'POST',
    })
    setBusy(false)
    setMsg(res.ok ? 'Pushed — kiosk will update within 60s' : `Error: ${res.status}`)
  }

  if (isNewDoc) return null

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <button onClick={click} disabled={busy} style={{ padding: '0.5rem 1rem' }}>
        {busy ? 'Pushing…' : 'Push update to this kiosk'}
      </button>
      {msg && <span style={{ marginLeft: '0.75rem', opacity: 0.7 }}>{msg}</span>}
    </div>
  )
}
