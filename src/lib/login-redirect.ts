/**
 * Shared contract for the `redirect` query param on `/admin/login`.
 *
 * Payload's admin shell already sends unauthenticated visitors to
 * `/admin/login?redirect=<original-path>` (see `handleAuthRedirect` in
 * @payloadcms/next); custom admin pages use `loginUrl()` to do the same.
 * `safeLoginRedirect()` is the single place that validates the param
 * before navigating after login, so a crafted link can't bounce a fresh
 * login to another origin.
 *
 * Client-safe: no server-only imports (LoginView consumes this).
 */

export function loginUrl(redirectTo: string): string {
  return `/admin/login?redirect=${encodeURIComponent(redirectTo)}`
}

export function safeLoginRedirect(raw: string | null | undefined): string {
  const fallback = '/admin'
  if (!raw) return fallback
  // Internal absolute paths only. "//host" and "/\host" are treated as
  // protocol-relative URLs by browsers, so require exactly one leading slash.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return fallback
  }
  return raw
}
