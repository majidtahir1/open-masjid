/**
 * Pull a human-friendly submitter name out of a form-submission `data`
 * blob. Forms label the name field inconsistently (`name`, `firstName`,
 * `fullName`, `your_name`, etc.), so we check a small set of common keys
 * in priority order and combine first+last when both are present.
 *
 * Returns `null` when no name-shaped value is found — callers should fall
 * back gracefully (empty greeting, "there", etc.) rather than leaking the
 * submitter's email into copy meant for a name.
 */
export function extractSubmitterName(data: Record<string, unknown>): string | null {
  const str = (k: string): string | null => {
    const v = data[k]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const first = str('firstName') ?? str('first_name') ?? str('first')
  const last = str('lastName') ?? str('last_name') ?? str('last')
  if (first) return [first, last].filter(Boolean).join(' ')
  return (
    str('fullName') ??
    str('full_name') ??
    str('name') ??
    str('yourName') ??
    str('your_name') ??
    null
  )
}
