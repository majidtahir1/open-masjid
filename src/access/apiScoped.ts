import type { Access, PayloadRequest } from 'payload'

type UserWithStrategy = { _strategy?: string } | null | undefined
type UserWithScopes = { _strategy?: string; apiScopes?: string[] }

/**
 * Returns true if the request was authenticated using an API key strategy.
 * Relies on Payload's internal `_strategy` marker to distinguish API-key
 * callers from session-authenticated users. Typical usage: gating access
 * to resources that should only be callable via API key (e.g. webhooks).
 */
export const isApiKeyAuth = (req: PayloadRequest): boolean => {
  const user = req.user as UserWithStrategy
  return user?._strategy === 'api-key'
}

/**
 * Wraps an existing Access function and gates it by a required API scope.
 * UI sessions and API keys with no scopes set pass through unchanged (back-compat);
 * API keys with a non-empty scope list must include `scope` or the call is denied.
 */
export const requireScope =
  (scope: string) =>
  (existing: Access): Access =>
  (args) => {
    const { req } = args
    const user = req.user as UserWithScopes
    if (user && isApiKeyAuth(req)) {
      const scopes = user.apiScopes ?? []
      if (scopes.length > 0 && !scopes.includes(scope)) return false
    }
    return existing(args)
  }
