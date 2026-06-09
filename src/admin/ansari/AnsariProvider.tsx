import React from 'react'
import AnsariWidget from './AnsariWidget'

// Server component: passes through children, mounts the client widget alongside.
// The widget self-gates to tenant admins (fetches /api/users/me) and the relay
// enforces role server-side, so it is safe to render here unconditionally.
export default function AnsariProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AnsariWidget />
    </>
  )
}
