import dynamicIconImports from 'lucide-react/dynamic'

// `iconNames` from lucide-react/dynamic is exported as an array in ESM but
// fails to interop cleanly when Payload/Next consume it from the CJS/server
// graph (it surfaces as a function). Derive the name set from the
// `dynamicIconImports` map instead, which interops reliably.
const iconSet = new Set(Object.keys(dynamicIconImports as Record<string, unknown>))

/**
 * Payload field validator for kebab-case Lucide icon names. Empty/undefined
 * is accepted (icon is optional on most fields); any non-empty value must
 * exist in Lucide's catalog or the admin gets an inline error.
 */
export function validateLucideIcon(value: unknown): true | string {
  if (value == null || value === '') return true
  if (typeof value !== 'string') return 'Icon must be a string.'
  const trimmed = value.trim()
  if (!trimmed) return true
  if (iconSet.size > 0 && !iconSet.has(trimmed)) {
    return `Not a Lucide icon name. Use kebab-case (e.g. "hand-heart"). Browse icons at https://lucide.dev/icons.`
  }
  return true
}
