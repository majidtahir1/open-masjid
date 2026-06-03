---
name: open-masjid-members
description: Use when the user wants to look up or count masjid members in OpenMasjid via natural language — "how many members do we have?", "how many active members?", "look up the member with email X", "find members named Ahmed", "who's on the Family tier?", "whose membership renews this week?". OpenMasjid (Payload CMS) specific; READ-ONLY (members:read). Member records are managed by Stripe webhooks — this skill cannot create or edit members.
---

# OpenMasjid Members (read-only)

Answer questions about a tenant's members — counts, lookups, tier/status breakdowns — by chatting. Talks to a running OpenMasjid instance via Payload's REST API with a scoped API key.

**REQUIRED FIRST:** read `../_shared/openmasjid-api.md` for auth, session bootstrap, the tenant rule, and error handling.

**Scope:** `members:read` only. **There is no `members:write` scope** — member records are created and updated by Stripe subscription webhooks, never by the API. If the user asks to add/edit/cancel a member, explain it's read-only and that membership changes happen through the member's Stripe subscription (or the admin UI for notes). Do not attempt a write.

## Collection: `members`

| Field | Type | Notes |
|---|---|---|
| `name` | text | Member's name. Partial match via `like`. |
| `email` | email | Unique per tenant. Exact match or `like`. |
| `phone` | text | |
| `tier` | relationship → `membership-tiers` | The membership plan. Stores the tier id; resolve names from `/api/membership-tiers`. |
| `status` | select | `"active"` · `"grace"` (in grace period) · `"inactive"`. Set by webhook from Stripe state. |
| `joinedAt` | date | When they joined. |
| `currentPeriodEnd` | date | Subscription renewal date — use for "renewing soon". |
| `canceledAt` | date | Set when canceled. |
| `tenant` | relationship | Server-side; reads auto-scope to the key's tenant. |

(Stripe ids and admin `notes` exist but aren't useful for lookups.)

## Querying

Reads are auto-scoped to the key's tenant — you don't need `where[tenant][equals]`. Every list response includes **`totalDocs`** (the full count regardless of `limit`), so `limit=0` is the cheap way to count.

| Question | Request |
|---|---|
| How many members total? | `GET /api/members?limit=0` → `totalDocs` |
| How many active? | `GET /api/members?limit=0&where[status][equals]=active` |
| How many in grace / inactive? | same with `status=grace` / `status=inactive` |
| Look up by email | `GET /api/members?where[email][equals]=<email>&limit=1` |
| Find by name (partial) | `GET /api/members?where[name][like]=<text>&limit=20` |
| Members on a tier | resolve tier id from `/api/membership-tiers?where[name][like]=<name>`, then `GET /api/members?where[tier][equals]=<tier-id>&limit=0` |
| Renewing within N days | `GET /api/members?where[currentPeriodEnd][greater_than_equal]=<today>&where[currentPeriodEnd][less_than]=<today+N>&sort=currentPeriodEnd` |

Combine filters with multiple `where[...]` params (Payload ANDs them). For tier names in output, either set `depth=1` (Payload populates the related tier object) or look the ids up once in `/api/membership-tiers`. `membership-tiers` has `name`, `amount` (dollars), `cadence` (`monthly`/`yearly`), `active`.

Answer in plain English. Report the count and a short list when listing people (name + email + status + tier). If `totalDocs` is 0, say "no members match" — don't invent records. Don't dump Stripe ids.

## Common mistakes

- Trying to create/edit/cancel a member → not possible (read-only, webhook-managed). Say so.
- Reading `totalDocs` off a `limit`ed page and thinking it's the page size — `totalDocs` is always the full match count; `docs.length` is the page.
- Adding `where[tenant][equals]` unnecessarily — reads already scope to the key's tenant (harmless, just redundant).
- Filtering `status` by anything other than `active` / `grace` / `inactive`.
