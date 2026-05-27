'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Radio } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function KioskPushButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

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
    setMsg(res.ok ? 'Pushed — updates in seconds' : `Error ${res.status}`)
    if (res.ok) setTimeout(() => setMsg(null), 4000)
  }

  if (isNewDoc) return null

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" onClick={click} disabled={busy}>
        <Radio aria-hidden />
        {busy ? 'Pushing…' : 'Push to this kiosk'}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  )
}
