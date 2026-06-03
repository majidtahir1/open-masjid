# OpenMasjid API — shared conventions

Plumbing common to every OpenMasjid domain skill (announcements, forms, events, members). Each skill links here; read this once per session, then follow the domain skill. OpenMasjid is Payload CMS 3.x, multi-tenant by host. These skills talk to a **running instance over the REST API with a scoped API key** — never the database or repo directly.

## Environment

- **`OPENMASJID_API_BASE`** — API host. Default `http://localhost:3000`. (Some older skills call this `OPENMASJID_BASE_URL`; accept either: `${OPENMASJID_API_BASE:-${OPENMASJID_BASE_URL:-http://localhost:3000}}`.) This is the bare API host — the key carries the tenant.
- **`OPENMASJID_API_KEY`** — a Payload user API key. Mint at `<base>/admin/collections/users` → edit your user → enable API Key → set `apiScopes` → save.

If `OPENMASJID_API_KEY` is unset or empty, tell the user how to set it and **stop** — do not proceed.

**Auth header on every call** (Payload's API-key format — the literal word `users`, then `API-Key`, easy to get wrong):

```
Authorization: users API-Key $OPENMASJID_API_KEY
```

## Session bootstrap (once per session, on first use)

1. `GET $OPENMASJID_API_BASE/api/users/me` with the auth header.
2. From the returned user note: `email`, `role`, `tenant` (id), `apiScopes`.
3. If `role === 'platformOwner'` and the user hasn't named a tenant, ask which tenant before any read/write. Resolve a slug to an id with `GET /api/tenants?where[slug][equals]=<slug>&limit=1`.
4. Print one confirmation line, e.g. `Connected as you@icp.org (admin, tenant: icp, scopes: announcements:read, announcements:write)`.

Cache `apiScopes` from this step and use it for the scope gate below — don't re-fetch per call.

## Scope gate (before any write)

Each domain maps to scopes (`<domain>:read` / `<domain>:write`). If the required scope is missing from the cached `apiScopes`, refuse cleanly and stop — do **not** attempt the write:

> Your API key doesn't have the `<scope>` scope. Ask your admin to grant it (Users → your account → API scopes), then mint a new key.

Members is **read-only** — there is no `members:write` scope.

## Tenant is server-side — never send it

Every collection has a `tenant` field set by a `setTenantFromUser` hook from the key's user. **Never** put `tenant` in a POST/PATCH body; it's ignored (or rejected) and only `platformOwner` could change it anyway. Reads are auto-scoped to the key's tenant, so you rarely need `where[tenant][equals]` — but it's harmless to include for a platformOwner key.

## Resolving records by name — handle 0 or multiple matches

Lookups by `title`/`name` use `like` (partial match) and can return zero or several docs. **Never auto-pick the first.** On zero matches, say so and stop. On multiple, list the candidates (title + date/id) and ask which one. Only act once you've resolved a single id.

## Dates: explicit offset, DST-correct

Emit datetimes as ISO 8601 **with an explicit offset**, never bare `Z`/UTC when the user means local time. The offset must match the **target date's** daylight-saving state — US zones are not fixed: Eastern is `-04:00` (EDT) in summer, `-05:00` (EST) in winter; Central is `-05:00`/`-06:00`, etc. Compute the offset for the event's actual date, don't copy an example's offset. If you don't know the masjid's timezone, ask. For a vague time-of-day ("evening", "end of day"), confirm the exact clock time rather than guessing.

## Public URLs need the tenant subdomain

The site resolves pages by host. **API calls** use the bare `$OPENMASJID_API_BASE`, but every **public link** you print or embed must use `<tenant>.<host>` — e.g. `icp.localhost:3000/forms/<slug>`, not `localhost:3000/forms/<slug>` (that 404s). Get the slug from the key's user: `/api/users/me` → `tenant` id → `GET /api/tenants/<id>` → `.slug`.

## richText fields are Lexical objects, never strings

Announcement `body`, Event `description`, Form `description` / `settings.successMessage` are **Lexical editor-state objects**. Passing a string crashes the admin ("The value passed to the Lexical editor is not an object"). Build them with this shape — one `paragraph` node per blank-line-separated block (URLs go in as plain text; clickable link nodes are out of scope):

```jsonc
{ "root": { "type": "root", "version": 1, "direction": null, "format": "", "indent": 0,
  "children": [
    { "type": "paragraph", "version": 1, "direction": null, "format": "", "indent": 0,
      "children": [ { "type": "text", "version": 1, "text": "First paragraph." } ] },
    { "type": "paragraph", "version": 1, "direction": null, "format": "", "indent": 0,
      "children": [ { "type": "text", "version": 1, "text": "Second paragraph." } ] }
  ] } }
```

Plain one-liners (Event `shortDescription`) are textareas — a string is correct there. If you don't need a rich body, **omit** the field rather than sending a string.

## Writes: diff-then-confirm (mandatory)

Before any POST/PATCH/DELETE, print a human-readable preview (for edits: `old → new` per changed field; for creates: the full object) and wait for an explicit "yes". On "no"/cancel/ambiguous, send nothing and say so. This applies to **every** write including reverts/undo — "put it back" is still a write; show the diff first.

Build complex JSON with the Write tool into a temp file and send via `curl ... -d @/tmp/<name>.json` — don't inline big JSON in the shell.

## Drafts vary by collection

- **Events** and **Announcements** use Payload drafts: `?draft=true` query param **and** `"_status": "draft"` in the body. Publish with `"_status": "published"`.
- **Forms** use a plain `status` field (`"draft"` | `"published"` | `"closed"`) in the body — **not** `_status`, no `?draft=true`.

## Error handling

| Response | Say |
|---|---|
| `401 Unauthorized` | API key is invalid or revoked. Mint a new one in the admin UI. |
| `403`, scope | Your key doesn't have the `<scope>` scope. Ask your admin to grant it. |
| `403`, billing lock | This tenant's billing is locked; edits are blocked until reactivated (admin → Billing). |
| `403`, tenant | This key can't access that tenant. |
| `400/422` validation | Show Payload's `errors[].message` (or response body) verbatim and offer to retry with a fix. |
| Connection refused | Is the dev server running at `$OPENMASJID_API_BASE`? |
| Network / 5xx | Surface the error; suggest checking the server. |

If a 403 body doesn't say which guard fired: "Access denied. Likely causes: missing scope, wrong tenant, or billing lock."

## Hard rules

- Never write without a diff preview and an explicit yes.
- Never invent an id, slug, tenant, or value — always resolve it from the API.
- Never send `tenant`; let the server hook set it.
- Never store the API key; read it from env each call.
