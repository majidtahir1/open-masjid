export interface ProgramRef {
  id: string | number
  status?: string | null
  startDate?: string | null
}

/**
 * Pick the selected program id from a `?program=` value and the tenant's
 * programs. The requested id wins if it exists; `'new'` means create mode
 * (null); otherwise default to the newest active program, then the newest of
 * any status, then null.
 */
export function resolveProgramId(requested: string | null | undefined, programs: ProgramRef[]): string | number | null {
  if (requested === 'new') return null
  if (requested) {
    const found = programs.find((p) => String(p.id) === String(requested))
    if (found) return found.id
  }
  const active = programs.filter((p) => p.status === 'active')
  const pool = active.length ? active : programs
  if (pool.length === 0) return null
  return [...pool].sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0].id
}
