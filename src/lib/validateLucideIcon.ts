import { iconNames } from 'lucide-react/dynamic'

const iconSet = new Set(iconNames as string[])

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
  if (!iconSet.has(trimmed)) {
    return `Not a Lucide icon name. Use kebab-case (e.g. "hand-heart"). Browse icons at https://lucide.dev/icons.`
  }
  return true
}
