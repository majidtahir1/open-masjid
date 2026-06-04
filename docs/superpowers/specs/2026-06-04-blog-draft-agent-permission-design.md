# Blog Draft Agent Permission — Design

**Date:** 2026-06-04
**Status:** Approved (design phase)
**Author:** Majid Tahir (with Claude)

## Problem

We want an AI agent (authenticated via a scoped API key) to be able to **push draft blog posts** to "The Minbar" (the `posts` collection) on openmasjid.app. The agent must be able to draft content for review but must never publish live content or alter posts that are already live.

Today the `posts` collection is `platformOwner`-only for all writes and is **not** registered in the API-key `SCOPE_MAP`, so scoped keys are denied access to it entirely (default-deny).

## Goals

The agent's permission must allow it to:

- **Read** posts, including drafts (so it can see what exists and edit its earlier work).
- **Create** new posts — always as drafts.
- **Edit existing drafts** — without the ability to flip them to published.

The agent must **not** be able to:

- Publish a post (set `_status: 'published'`), on create or update.
- Edit a post that is already published (no silent changes to live content).
- Delete posts.

A human `platformOwner` reviews drafts and publishes them through the admin UI. Existing `platformOwner` behavior (UI sessions, and unscoped/empty-`apiScopes` API keys) is unchanged.

## Non-Goals

- A natural-language **skill** (`open-masjid-blog`) for an agent to drive this via conversation. This is a logical follow-up that mirrors the existing announcements/events skills, but it is **out of scope** for this spec.
- A `blog:publish` scope or any agent-driven publishing path.
- Tenant-scoping of blog posts. The Minbar is **platform-level** content (not tenant content); this permission is a constrained slice of `platformOwner`, keyed off the API key's `apiScopes`, independent of the `staff`/`admin`/tenant role system.
- Scheduled publishing via the API. `schedulePublish` remains a `platformOwner`/admin-UI concern; forcing `_status: 'draft'` on every scoped-agent write neutralizes any agent attempt to publish immediately.

## Approach (chosen)

Reuse the established scoped-API-key pattern (the same mechanism used by `forms:write`, `events:write`, etc.), with **two independent guarantees** against publishing:

1. An **access-layer `where` filter** on `update` that only matches drafts — Payload simply won't find a published post to update, so "block editing published posts" is enforced by the data layer, not by trust.
2. A **`beforeChange` hook** that force-sets `_status: 'draft'` for any API-key request carrying `blog:write`, so even a request that explicitly sends `_status: 'published'` is coerced back to draft.

Defense in depth: even if one guard regresses, the other still prevents an agent from publishing.

### Why not the alternatives

- **Dedicated custom endpoint** (`POST /api/blog-drafts`): one isolated choke point, but diverges from the established scope pattern, re-implements auth, and the agent loses normal REST `read`/`update`.
- **Field-level access on `_status`**: granular but fiddly in Payload, and does nothing to stop editing an already-published post — you'd still need the `where` filter from the chosen approach.

## Design

### 1. New scopes — `src/collections/Users.ts`

Add to the `apiScopes` `select` options (keep ordering consistent with the existing list):

```ts
{ label: 'Blog (The Minbar) — read', value: 'blog:read' },
{ label: 'Blog (The Minbar) — write (drafts only)', value: 'blog:write' },
```

The `label` makes the draft-only constraint explicit in the admin UI where keys are configured.

### 2. Scope map — `src/access/apiScoped.ts`

Add a `posts` entry to `SCOPE_MAP`:

```ts
posts: {
  read: 'blog:read',
  create: 'blog:write',
  update: 'blog:write',
  // delete intentionally unmapped — scoped keys are denied delete (default-deny).
},
```

`isApiKeyAuth` is already exported from this module and can be reused by the Posts hook — no change needed there.

Note the central `withApiKeyScopeEnforcement` gate runs **first** and then defers to the collection's own access function. So a scoped key with `blog:write` passes the gate for `update`, then receives the collection's `update` `where` filter. Scope gating and the collection access both apply.

### 3. `Posts` access — `src/collections/Posts.ts`

Replace the current access block. Behavior by caller:

```ts
access: {
  // platformOwner sees everything; a blog:read API key sees drafts too;
  // everyone else (public, other roles) sees only published.
  read: ({ req }) => {
    const user = req.user as { role?: string } | null
    if (user?.role === 'platformOwner') return true
    if (isApiKeyAuth(req)) return true // scope gate already required blog:read
    return { _status: { equals: 'published' } }
  },
  // platformOwner or a blog:write API key may create (hook forces draft).
  create: ({ req }) => {
    const user = req.user as { role?: string } | null
    if (user?.role === 'platformOwner') return true
    return isApiKeyAuth(req) // scope gate already required blog:write
  },
  // platformOwner may update anything; a blog:write API key may update
  // ONLY drafts (the where filter excludes published posts).
  update: ({ req }) => {
    const user = req.user as { role?: string } | null
    if (user?.role === 'platformOwner') return true
    if (isApiKeyAuth(req)) return { _status: { equals: 'draft' } }
    return false
  },
  delete: platformOwnerOnly, // unchanged
}
```

`isApiKeyAuth` is imported from `../access/apiScoped`. Relying on the central scope gate to enforce the *specific* scope (`blog:read` vs `blog:write`) keeps the collection file from duplicating scope-string logic — the gate denies the op before this function runs if the key lacks the right scope. (An unscoped/empty-`apiScopes` API key would also reach here and be treated as allowed; that matches today's back-compat semantics where empty scopes = full role permissions, and such keys are platform-owned anyway.)

### 4. `beforeChange` hook — `src/collections/Posts.ts`

Add a collection-level `hooks.beforeChange` that coerces draft status for scoped agents:

```ts
const forceDraftForScopedAgents: CollectionBeforeChangeHook = ({ data, req }) => {
  const user = req.user as { apiScopes?: string[] } | null
  if (isApiKeyAuth(req) && (user?.apiScopes ?? []).includes('blog:write')) {
    return { ...data, _status: 'draft' }
  }
  return data
}
```

Gating on `blog:write` (not merely `isApiKeyAuth`) means a `platformOwner` using an unscoped API key is **not** coerced and retains full publish ability — only true draft-only agents are forced to draft.

### 5. Migration — `src/migrations/`

Follow the text-swap pattern from `20260601_205903_media_api_scopes.ts` (Postgres disallows `ALTER TYPE ... ADD VALUE` inside Payload's migration transaction). The new full enum value list, in the same order as `Users.apiScopes`:

```
'prayer-times:read', 'prayer-times:write',
'announcements:read', 'announcements:write',
'forms:read', 'forms:write',
'events:read', 'events:write',
'members:read',
'media:read', 'media:write',
'blog:read', 'blog:write'
```

`up`: swap `users_api_scopes.value` to `text`, drop & recreate `enum_users_api_scopes` with the list above, swap back. `down`: same, recreating the enum **without** `blog:read`/`blog:write`. Keep the value list in sync with `Users.apiScopes` options.

## Components & Data Flow

```
Agent (API key, apiScopes=['blog:read','blog:write'])
  → REST POST/PATCH/GET /api/posts
  → withApiKeyScopeEnforcement gate (apiScoped.ts)
      • read  → requires blog:read, else 403
      • create/update → requires blog:write, else 403
      • delete → unmapped → 403
  → Posts.access (collection)
      • create → true (agent)
      • update → { _status: { equals: 'draft' } }  (published posts invisible → 404/denied)
      • read   → true (agent sees drafts)
  → Posts.hooks.beforeChange: forceDraftForScopedAgents
      • _status coerced to 'draft'
  → write persists as draft
Human platformOwner → admin UI → reviews & publishes
```

## Error Handling

- Missing/insufficient scope → Payload returns Forbidden (403) from the access gate. No special handling required.
- Agent attempts to update a published post → the `update` `where` filter excludes it; Payload reports the document as not found / not permitted. The post is untouched.
- Agent sends `_status: 'published'` → coerced to `'draft'` by the hook; the write succeeds as a draft (fail-safe, not fail-loud — acceptable since the intent is "drafts only").
- Agent attempts delete → 403 (delete unmapped in `SCOPE_MAP`).

## Testing

Integration tests (mirroring existing scoped-key tests for forms/events) covering, for a key with `apiScopes: ['blog:read','blog:write']`:

1. **Create** a post → succeeds and persists with `_status: 'draft'`.
2. **Create** a post explicitly sending `_status: 'published'` → persists as `'draft'` (hook coercion).
3. **Update** an existing **draft** → succeeds, stays `'draft'`.
4. **Update** an existing **published** post → denied / not found (where filter).
5. **Read** → returns drafts as well as published.
6. **Delete** → 403.
7. A key **without** `blog:read` → cannot read posts (403).
8. A key **without** `blog:write` → cannot create/update (403).
9. `platformOwner` UI session and unscoped `platformOwner` API key → unchanged: can still create, update, publish, and delete.

## Files Touched

| File | Change |
|------|--------|
| `src/collections/Users.ts` | Add `blog:read`, `blog:write` to `apiScopes` options |
| `src/access/apiScoped.ts` | Add `posts` entry to `SCOPE_MAP` |
| `src/collections/Posts.ts` | New access block; import `isApiKeyAuth`; add `forceDraftForScopedAgents` `beforeChange` hook |
| `src/migrations/<new>.ts` | Text-swap migration adding the two enum values (with matching `down`) |
| tests | New integration tests for the scenarios above |
