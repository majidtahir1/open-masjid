'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--brand, #1f3a8a)',
    background: 'var(--brand, #1f3a8a)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
  } as React.CSSProperties,
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'currentColor',
    opacity: 0.9,
  } as React.CSSProperties,
  msg: {
    fontSize: 12,
    color: 'var(--fg3, #6b7280)',
  } as React.CSSProperties,
}

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
    setMsg(res.ok ? 'Pushed — kiosk updates within seconds' : `Error ${res.status}`)
    if (res.ok) setTimeout(() => setMsg(null), 4000)
  }

  if (isNewDoc) return null

  return (
    <div style={styles.wrap}>
      <button
        onClick={click}
        disabled={busy}
        style={{ ...styles.btn, opacity: busy ? 0.6 : 1 }}
      >
        <span style={styles.dot} aria-hidden />
        {busy ? 'Pushing…' : 'Push update to this kiosk'}
      </button>
      {msg && <span style={styles.msg}>{msg}</span>}
    </div>
  )
}
