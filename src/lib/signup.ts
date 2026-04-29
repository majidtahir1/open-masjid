/**
 * Pure helpers for the public signup flow.
 *
 * Validation, slug normalization, reserved-slug list, and a tiny in-memory
 * IP throttle live here so they can be unit-tested without spinning up
 * Payload or a request lifecycle.
 */

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'www',
  'api',
  'app',
  'mail',
  'static',
  'assets',
  'cdn',
  'marketing',
  'docs',
  'blog',
])

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/

export type SlugProblem = 'format' | 'reserved' | null

export function validateSlug(input: string): SlugProblem {
  if (!SLUG_RE.test(input)) return 'format'
  if (RESERVED_SLUGS.has(input)) return 'reserved'
  return null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(input: string): boolean {
  return EMAIL_RE.test(input)
}

/**
 * Generate up to 3 alternative slug suggestions when the requested slug is
 * taken or reserved. Caller is responsible for verifying availability of the
 * suggestions before showing them.
 */
export function suggestAlternativeSlugs(base: string): string[] {
  const safe = base.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'masjid'
  const trimmed = safe.slice(0, 24)
  const random4 = Math.random().toString(36).slice(2, 6)
  return [
    `${trimmed}-masjid`.slice(0, 32),
    `${trimmed}-2`.slice(0, 32),
    `${trimmed}-${random4}`.slice(0, 32),
  ]
}

/**
 * Per-IP throttle for the signup endpoint. In-memory Map = good enough for
 * v1 single-instance dev and low-traffic prod. Swap for Redis when you have
 * multiple app instances or real abuse.
 */
const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_PER_WINDOW = 5
const ipHits = new Map<string, number[]>()

export function checkIpThrottle(ip: string, now: number = Date.now()): { ok: boolean; retryAfterSeconds?: number } {
  const cutoff = now - WINDOW_MS
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > cutoff)
  if (hits.length >= MAX_PER_WINDOW) {
    const oldest = hits[0]
    return { ok: false, retryAfterSeconds: Math.ceil((oldest + WINDOW_MS - now) / 1000) }
  }
  hits.push(now)
  ipHits.set(ip, hits)
  return { ok: true }
}

// Exposed for tests only.
export function _resetIpThrottleForTests() {
  ipHits.clear()
}
