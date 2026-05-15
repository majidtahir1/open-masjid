'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

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
    <span className="inline-flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={click} disabled={busy}>
        <RotateCcw aria-hidden />
        {busy ? 'Resetting…' : 'Reset pairing'}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </span>
  )
}
