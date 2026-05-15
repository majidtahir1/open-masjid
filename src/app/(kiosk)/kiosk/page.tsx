'use client'

import { useEffect, useState } from 'react'

type Claim =
  | { status: 'paired'; deviceId: string; secret: string }
  | { status: string }

function makeLocalCode(): string {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const r = (n: number) =>
    Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join('')
  return `${r(3)}-${r(3)}`
}

export default function PairingPage() {
  const [code, setCode] = useState<string>('')
  const [status, setStatus] = useState<string>('waiting')

  useEffect(() => {
    // If this device is already paired, skip the pairing screen entirely.
    const existingDeviceId = localStorage.getItem('kiosk:deviceId')
    const existingSecret = localStorage.getItem('kiosk:secret')
    if (existingDeviceId && existingSecret) {
      window.location.replace(`/kiosk/${existingDeviceId}`)
      return
    }
    const saved = localStorage.getItem('kiosk:pairingCode')
    const initial = saved || makeLocalCode()
    if (!saved) localStorage.setItem('kiosk:pairingCode', initial)
    setCode(initial)
  }, [])

  useEffect(() => {
    if (!code) return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch('/api/kiosk/claim', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data: Claim = await res.json().catch(() => ({ status: 'error' }))
        if (cancelled) return
        if (data.status === 'paired' && 'deviceId' in data) {
          localStorage.setItem('kiosk:deviceId', data.deviceId)
          localStorage.setItem('kiosk:secret', data.secret)
          localStorage.removeItem('kiosk:pairingCode')
          window.location.replace(`/kiosk/${data.deviceId}`)
          return
        }
        setStatus(data.status)
      } catch {
        if (!cancelled) setStatus('network-error')
      }
    }

    tick()
    const id = setInterval(tick, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [code])

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p style={{ opacity: 0.6, marginBottom: '1rem', fontSize: '1.5rem' }}>
        Enter this code in your admin panel
      </p>
      <h1 style={{ fontSize: '12rem', letterSpacing: '0.1em', margin: 0 }}>
        {code || '...'}
      </h1>
      <p style={{ marginTop: '2rem', opacity: 0.5 }}>
        {status === 'waiting' ? 'Waiting for pairing...' : `Status: ${status}`}
      </p>
    </main>
  )
}
