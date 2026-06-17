'use client'

/** Fetch wrapper for Payload REST under the logged-in admin session. */
export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}
