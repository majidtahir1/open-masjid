/**
 * Payload field validator for Lucide icon names.
 *
 * We don't validate against Lucide's catalog here — that import chain hits
 * ESM/CJS interop issues when Payload's config loader pulls it in. The
 * `LucideIcon` component already falls back to a default when a name doesn't
 * resolve at render time, so typos degrade gracefully on the public site.
 * This validator just enforces the kebab-case shape so obviously-wrong
 * values (spaces, caps, punctuation) are rejected at save time.
 */
export function validateLucideIcon(value: unknown): true | string {
  if (value == null || value === '') return true
  if (typeof value !== 'string') return 'Icon must be a string.'
  const trimmed = value.trim()
  if (!trimmed) return true
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed)) {
    return 'Use kebab-case (lowercase letters/digits, hyphens only). Example: "hand-heart". Browse icons at https://lucide.dev/icons.'
  }
  return true
}
