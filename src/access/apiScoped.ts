import type { Access, CollectionConfig, PayloadRequest } from 'payload'

type UserWithStrategy = { _strategy?: string } | null | undefined
type UserWithScopes = { _strategy?: string; apiScopes?: string[] }
type Op = 'read' | 'create' | 'update' | 'delete'

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
 * Maps a (collection slug, operation) pair to the scope string a key must
 * carry to perform that operation. Anything not listed here is implicitly
 * denied for keys with non-empty `apiScopes` — default-deny is the whole
 * point of scoped keys.
 *
 * Adding a new scope means: extend `User.apiScopes` options, then add an
 * entry here. The two must stay in sync.
 */
const SCOPE_MAP: Record<string, Partial<Record<Op, string>>> = {
  'prayer-schedules': {
    read: 'prayer-times:read',
    create: 'prayer-times:write',
    update: 'prayer-times:write',
    delete: 'prayer-times:write',
  },
}

/**
 * Payload's default access policy when a collection doesn't define one
 * for a given operation: allow if there's an authenticated user. Used as
 * the fallback when we wrap a missing access function.
 */
const PAYLOAD_DEFAULT_ACCESS: Access = ({ req }) => Boolean(req.user)

/**
 * Wraps an existing Access function with API-key scope enforcement for
 * `(slug, op)`. Semantics:
 *
 * - UI session (`_strategy !== 'api-key'`) → defer to `existing`. Scopes never restrict UI.
 * - API key, empty/missing `apiScopes` → defer to `existing`. Back-compat for unscoped keys.
 * - API key, non-empty `apiScopes`, `(slug, op)` is mapped and the required scope is present
 *   → defer to `existing` (tenant scoping, billing lock, role checks still apply).
 * - API key, non-empty `apiScopes`, `(slug, op)` is unmapped OR the required scope is missing
 *   → deny. This is the default-deny behavior that makes scoped keys actually scoped.
 */
export const gateByApiKeyScope =
  (slug: string, op: Op) =>
  (existing: Access | undefined): Access =>
  (args) => {
    const { req } = args
    const user = req.user as UserWithScopes | null | undefined
    if (user && isApiKeyAuth(req)) {
      const scopes = user.apiScopes ?? []
      if (scopes.length > 0) {
        const required = SCOPE_MAP[slug]?.[op]
        if (!required || !scopes.includes(required)) return false
      }
    }
    return (existing ?? PAYLOAD_DEFAULT_ACCESS)(args)
  }

/**
 * Wraps a CollectionConfig so all four CRUD access functions are gated by
 * API-key scopes. Applied centrally in `payload.config.ts` so every
 * collection inherits the default-deny semantics — opting a new collection
 * into scoped-key access means adding it to `SCOPE_MAP`, not editing the
 * collection file.
 */
export const withApiKeyScopeEnforcement = (c: CollectionConfig): CollectionConfig => ({
  ...c,
  access: {
    ...(c.access ?? {}),
    read: gateByApiKeyScope(c.slug, 'read')(c.access?.read),
    create: gateByApiKeyScope(c.slug, 'create')(c.access?.create),
    update: gateByApiKeyScope(c.slug, 'update')(c.access?.update),
    delete: gateByApiKeyScope(c.slug, 'delete')(c.access?.delete),
  },
})
