'use client'

/** Fetch wrapper for Payload REST under the logged-in admin session. */
export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    // Surface Payload's validation/error detail instead of just the status code.
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.errors?.[0]?.message || body?.message || ''
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return res.json()
}

/**
 * Coerce an id sourced from a DOM value (always a string) to the type Payload
 * expects. Postgres collections use integer ids, and Payload's relationship
 * validation rejects a numeric-looking string ("5") for an integer relation.
 * All-digit strings become numbers; anything else (e.g. Mongo ObjectIds) is
 * left as-is.
 */
export function toId(v: string | number): string | number {
  if (typeof v === 'number') return v
  return /^\d+$/.test(v) ? Number(v) : v
}
