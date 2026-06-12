// src/ansari/canonical.ts
/**
 * Key-order-independent serialization. Stored intents/actions round-trip
 * through Postgres jsonb, which does NOT preserve key order, so plain
 * JSON.stringify equality is unreliable for anything read back from the DB.
 */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
