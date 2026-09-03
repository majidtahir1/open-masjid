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
  announcements: {
    read: 'announcements:read',
    create: 'announcements:write',
    update: 'announcements:write',
    delete: 'announcements:write',
  },
  forms: {
    read: 'forms:read',
    create: 'forms:write',
    update: 'forms:write',
    delete: 'forms:write',
  },
  // Signup counts + response summaries live here; read-only under forms:read.
  // create/update/delete intentionally unmapped — submissions are written only
  // by the public submit endpoint (role access is already () => false).
  'form-submissions': {
    read: 'forms:read',
  },
  events: {
    read: 'events:read',
    create: 'events:write',
    update: 'events:write',
    delete: 'events:write',
  },
  // Read-only in v1 — no members:write scope exists.
  members: {
    read: 'members:read',
  },
  // Flyer/image uploads (e.g. flyer-to-event) need to create media docs.
  media: {
    read: 'media:read',
    create: 'media:write',
    update: 'media:write',
    delete: 'media:write',
  },
  // The Minbar (platform-level blog). Agents may read + draft, never publish:
  // delete is unmapped (denied), and Posts' access + a beforeChange hook keep
  // scoped keys on drafts only. blog:write covers create + update.
  posts: {
    read: 'blog:read',
    create: 'blog:write',
    update: 'blog:write',
  },
  // NOTE: donations / donation-funds are intentionally NOT mapped here.
  // Donation Q&A (totals by fund/month) needs a custom sum endpoint that
  // Payload REST can't provide — deferred to v1.1.
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
    const user = req.user as (UserWithScopes & { id?: string | number }) | null | undefined
    if (user && isApiKeyAuth(req)) {
      const scopes = user.apiScopes ?? []
      if (scopes.length > 0) {
        // Session bootstrap for scoped keys: `/api/users/me` runs `findByID`
        // on users with access enforced, and agents then resolve the tenant
        // slug via `/api/tenants/<id>`. Neither collection is scope-mapped, so
        // without these carve-outs every scoped key 403s before its first real
        // call. Self-read is strictly narrower than any role's users read;
        // tenants read already limits non-owners to their own tenant.
        if (op === 'read' && slug === 'users') return { id: { equals: user.id } }
        if (op === 'read' && slug === 'tenants') return (existing ?? PAYLOAD_DEFAULT_ACCESS)(args)
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
