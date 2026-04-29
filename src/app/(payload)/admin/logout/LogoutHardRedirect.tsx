'use client'

import { useEffect } from 'react'

/**
 * After the server-side logout has cleared the auth cookie, this component
 * forces a full browser navigation (not a Next.js soft nav) to the login
 * page. The hard navigation throws away the Router Cache and any in-memory
 * client state from the prior session, so the next user starts clean.
 */
export default function LogoutHardRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to)
  }, [to])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#6b7280',
      }}
    >
      Signing out…
    </div>
  )
}
