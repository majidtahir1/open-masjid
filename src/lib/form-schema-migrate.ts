// src/lib/form-schema-migrate.ts
//
// Field-rename migration for form submissions. Submission answers are stored
// as a flat `data` object keyed by the field's `name` at submit time, so
// renaming a field would orphan existing answers under the old key. These
// helpers detect renames between two schema versions (fields matched by their
// stable `id`) and re-key a submission's data accordingly. Used by the Forms
// collection's afterChange hook.

import { validateSchema } from './form-schema'

export interface FieldRename {
  from: string
  to: string
}

/**
 * Compare two form schemas and report fields whose `name` changed.
 * Fields are matched by `id`, which the builder keeps stable across edits.
 * Returns [] when either schema is missing/invalid.
 */
export function detectFieldRenames(prevSchema: unknown, nextSchema: unknown): FieldRename[] {
  const prev = validateSchema(prevSchema)
  const next = validateSchema(nextSchema)
  if (!prev.success || !next.success) return []

  const prevNamesById = new Map<string, string>()
  for (const step of prev.schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'page-break') continue
      prevNamesById.set(f.id, f.name)
    }
  }

  const renames: FieldRename[] = []
  for (const step of next.schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'page-break') continue
      const prevName = prevNamesById.get(f.id)
      if (prevName !== undefined && prevName !== f.name) {
        renames.push({ from: prevName, to: f.name })
      }
    }
  }
  return renames
}

/**
 * Re-key a submission's data object per the renames. Two-phase so swapping
 * two field names in one save works. A rename is skipped (data preserved
 * under the old key) if the target key would clobber a value that no rename
 * moves away — that only happens with stale orphan keys from historic
 * renames, and losing data is worse than a leftover key.
 */
export function applyRenames(
  data: Record<string, unknown>,
  renames: FieldRename[],
): { changed: boolean; data: Record<string, unknown> } {
  const applicable = renames.filter((r) => r.from in data && r.from !== r.to)
  if (applicable.length === 0) return { changed: false, data }

  const vacated = new Set(applicable.map((r) => r.from))
  const safe = applicable.filter((r) => !(r.to in data) || vacated.has(r.to))
  if (safe.length === 0) return { changed: false, data }

  const next: Record<string, unknown> = { ...data }
  const moved = new Map<string, unknown>()
  for (const r of safe) {
    moved.set(r.to, next[r.from])
    delete next[r.from]
  }
  for (const [key, value] of moved) {
    next[key] = value
  }
  return { changed: true, data: next }
}
