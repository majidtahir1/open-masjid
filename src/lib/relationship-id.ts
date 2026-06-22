/**
 * Helpers for Payload relationship values, which are either a populated object
 * (`{ id, ... }`) or a raw scalar id depending on `depth`.
 *
 * These centralize the id-coercion logic that was previously copy-pasted as
 * ad-hoc `idOf` / `relId` constants across the school, check-in, and access
 * code — including the Postgres gotcha that integer relations reject
 * numeric-looking strings on write.
 */

/** Extract the id from a relationship value; null for nullish input. */
export function relId(v: unknown): string | number | null {
  if (v == null) return null
  if (typeof v === 'object' && 'id' in v) return (v as { id: string | number }).id
  return v as string | number
}

/** Like {@link relId}, stringified — convenient for Map keys / Set membership. */
export function relIdStr(v: unknown): string {
  const id = relId(v)
  return id == null ? '' : String(id)
}

/**
 * Coerce an all-digit string id back to a number for writes: Postgres integer
 * relations reject numeric-looking strings (e.g. "94") on create/update.
 * Non-numeric ids (e.g. Mongo ObjectIds) pass through unchanged.
 */
export function toWriteId(v: string | number): string | number {
  return typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v
}
