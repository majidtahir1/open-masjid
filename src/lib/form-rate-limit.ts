const buckets = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 60_000
const LIMIT = 5

export function checkRateLimit(key: string, now = Date.now()): boolean {
  const b = buckets.get(key)
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now })
    return true
  }
  if (b.count >= LIMIT) return false
  b.count++
  return true
}

export function _resetForTest() { buckets.clear() }
