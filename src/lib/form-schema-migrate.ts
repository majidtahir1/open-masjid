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
  /**
   * When set, this rename re-keys a child field *inside* the named
   * repeatable-group's item array (`data[group][i][from] → [to]`) rather than
   * a top-level key. Top-level field renames leave this undefined.
   */
  group?: string
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

  // Top-level fields: id → name.
  const prevNamesById = new Map<string, string>()
  // Group children: childId → { group: previous group name, name: child name }.
  const prevChildById = new Map<string, { group: string; name: string }>()
  for (const step of prev.schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'page-break') continue
      prevNamesById.set(f.id, f.name)
      if (f.type === 'repeatable-group') {
        for (const child of f.fields) prevChildById.set(child.id, { group: f.name, name: child.name })
      }
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
      if (f.type === 'repeatable-group') {
        // Descend into child fields. A child rename is scoped to this group's
        // *current* name so applyRenames knows which nested array to re-key.
        for (const child of f.fields) {
          const prevChild = prevChildById.get(child.id)
          if (prevChild !== undefined && prevChild.name !== child.name) {
            renames.push({ from: prevChild.name, to: child.name, group: f.name })
          }
        }
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
/**
 * Re-key one flat object per the renames (two-phase, clobber-safe). Returns the
 * same object reference when nothing applies. Used for both the top-level data
 * object and each item inside a repeatable-group.
 */
function rekeyObject(
  data: Record<string, unknown>,
  renames: Array<{ from: string; to: string }>,
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

export function applyRenames(
  data: Record<string, unknown>,
  renames: FieldRename[],
): { changed: boolean; data: Record<string, unknown> } {
  const topRenames = renames.filter((r) => r.group === undefined)
  const groupRenames = renames.filter((r) => r.group !== undefined)

  // Phase 1: top-level keys.
  const top = rekeyObject(data, topRenames)
  let changed = top.changed
  const next = top.changed ? top.data : { ...data }

  // Phase 2: re-key child fields inside each repeatable-group's item array.
  // Group by the (current) group name so each nested array is re-keyed once.
  const byGroup = new Map<string, Array<{ from: string; to: string }>>()
  for (const r of groupRenames) {
    const list = byGroup.get(r.group!) ?? []
    list.push({ from: r.from, to: r.to })
    byGroup.set(r.group!, list)
  }
  for (const [group, childRenames] of byGroup) {
    const items = next[group]
    if (!Array.isArray(items)) continue
    let groupChanged = false
    const rekeyed = items.map((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
      const res = rekeyObject(item as Record<string, unknown>, childRenames)
      if (res.changed) groupChanged = true
      return res.data
    })
    if (groupChanged) {
      next[group] = rekeyed
      changed = true
    }
  }

  if (!changed) return { changed: false, data }
  return { changed: true, data: next }
}
