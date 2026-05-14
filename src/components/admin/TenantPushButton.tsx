'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Tenant-wide "Push to all kiosks" button for kiosk content collections.
 * POSTs to /api/kiosk/push with no query — the endpoint uses the caller's
 * tenant. Hidden on create form (no doc to push from yet).
 */
export default function TenantPushButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const pathname = usePathname() ?? ''
  const segments = pathname.split('/')
  // Last segment is "create" on new-doc forms.
  const isNewDoc = segments[segments.length - 1] === 'create'

  const click = async () => {
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/kiosk/push', { method: 'POST' })
    setBusy(false)
    setMsg(res.ok ? 'Pushed — kiosks will update within 60s' : `Error: ${res.status}`)
  }

  if (isNewDoc) return null

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <button onClick={click} disabled={busy} style={{ padding: '0.5rem 1rem' }}>
        {busy ? 'Pushing…' : 'Push to all kiosks'}
      </button>
      {msg && <span style={{ marginLeft: '0.75rem', opacity: 0.7 }}>{msg}</span>}
    </div>
  )
}
