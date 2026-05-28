# OpenMasjid Prayer Times Chat Skill — Design

**Date:** 2026-05-28
**Status:** Draft, pending implementation plan
**Author:** brainstorming session with Majid

---

## 1. Goal

Let a tenant admin edit their masjid's prayer times by chatting in natural language — e.g. "change Fajr to 5:30 AM."

This document specifies a **Claude Code skill** (`open-masjid-prayer-times`) as a proof-of-concept for that interaction, plus the small platform change required to authenticate it safely (scoped API keys on `Users`).

### Long-term vision

Eventually OpenMasjid will ship with a bundled chat bot (Hermes-style) so any tenant admin can manage their site by chatting in-app. The skill is throwaway, but the *patterns* it validates — natural-language disambiguation, diff-then-confirm, scope-limited API keys — are not. The platform changes here (API keys, scopes) carry forward to the productized bot.

### Non-goals (POC)

- No in-app chat UI.
- No hosted LLM cost; the LLM is Claude running locally in the operator's terminal.
- No MCP server (see §8 for the rationale).
- No edits to anything outside `PrayerSchedules` iqamah rules.
- No schedule creation; if no schedule covers today, the skill points the user at the admin UI.
- No per-day overrides, no Jummah edits — both are v2 candidates.

---

## 2. Scope (v1)

**In scope — writes:**

- Update an active `PrayerSchedules` document's **iqamah rules** for any of the five daily prayers (Fajr / Zuhr / Asr / Maghrib / Isha). Both `absolute` and `offset` modes supported.
- The existing `autoRegeneratePrayerDays` hook recomputes the per-day `days[]` array server-side after the rule change; the skill does not write into `days[]` directly.

**In scope — reads:**

- Active schedule for a tenant covering a given date (default: today).
- Current iqamah rule per prayer.
- Today's (or any chosen day's) adhan + iqamah times from `days[]`.
- Jummah times (read only).

**Out of scope (v1):**

- Per-day overrides ("set just Friday's Asr iqamah to 4:00").
- Jummah time writes.
- Schedule creation, deletion, or date-range edits.
- Announcements, events, members, donations, or any non-PrayerSchedules collection.

---

## 3. Architecture

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│ Claude Code (operator's CLI) │  curl   │ OpenMasjid (Next.js/Payload) │
│  └─ open-masjid-prayer-times │ ──────▶ │  POST /api/users/login OR    │
│     SKILL.md (prompt)        │  HTTP   │  Authorization: users         │
│                              │         │    API-Key <key>             │
└──────────────────────────────┘         │                              │
                                         │  Access controls enforce:    │
                                         │   • tenant scoping           │
                                         │   • role checks              │
                                         │   • billing lock             │
                                         │   • apiScopes (new)          │
                                         └──────────────────────────────┘
```

The skill is a single prompt file. It contains no code; it teaches Claude how to make HTTP calls against the existing Payload REST API. All authorization is enforced server-side by Payload's existing access control chain, with a new platform-wide gate (`gateByApiKeyScope`) that default-denies scoped API keys on every unmapped collection.

### Why REST and not the Payload local API

The local API requires loading Payload in-process (as `scripts/seed.ts` does), which means a fresh module load and DB connection per skill invocation. REST is faster end-to-end against a running dev server and — critically — exactly mirrors the contract the productized in-app bot will use. The skill validates the same surface the bot will inherit.

### Why a skill and not an MCP server (for v1)

See §8.

---

## 4. Platform change: scoped API keys on Users

This is the only repo change required to support the skill, and it stands on its own as a platform feature.

### 4.1 Schema

Enable Payload's built-in API key auth on the `Users` collection and add an `apiScopes` field:

```ts
// src/collections/Users.ts
export const Users: CollectionConfig = {
  ...,
  auth: {
    ...existingAuthConfig,
    useAPIKey: true,
  },
  fields: [
    ...,
    {
      name: 'apiScopes',
      type: 'select',
      hasMany: true,
      label: 'API scopes',
      admin: {
        description:
          "Restricts what this user's API key can do. Empty = the key inherits the user's full role permissions. UI session permissions are never restricted by this field.",
        condition: (data) => Boolean(data?.enableAPIKey),
      },
      options: [
        { label: 'Prayer times — read',  value: 'prayer-times:read' },
        { label: 'Prayer times — write', value: 'prayer-times:write' },
        // Future scopes (not implemented in v1):
        //   'announcements:read', 'announcements:write',
        //   'events:read',        'events:write',
        //   etc.
      ],
    },
  ],
}
```

### 4.2 Enforcement helper

Detect API-key auth via Payload's `req.user._strategy === 'api-key'` marker (set by `node_modules/payload/dist/auth/strategies/apiKey.js`). Build a `(slug, op) → required scope` map and gate every collection's access against it centrally.

```ts
// src/access/apiScoped.ts
import type { Access, CollectionConfig, PayloadRequest } from 'payload'

type Op = 'read' | 'create' | 'update' | 'delete'

export const isApiKeyAuth = (req: PayloadRequest): boolean =>
  (req.user as { _strategy?: string } | null)?._strategy === 'api-key'

// Adding a new scope means: extend User.apiScopes options AND add an entry here.
const SCOPE_MAP: Record<string, Partial<Record<Op, string>>> = {
  'prayer-schedules': {
    read: 'prayer-times:read',
    create: 'prayer-times:write',
    update: 'prayer-times:write',
    delete: 'prayer-times:write',
  },
}

const PAYLOAD_DEFAULT_ACCESS: Access = ({ req }) => Boolean(req.user)

export const gateByApiKeyScope =
  (slug: string, op: Op) =>
  (existing: Access | undefined): Access =>
  (args) => {
    const { req } = args
    const user = req.user as { _strategy?: string; apiScopes?: string[] } | null
    if (user && isApiKeyAuth(req)) {
      const scopes = user.apiScopes ?? []
      if (scopes.length > 0) {
        const required = SCOPE_MAP[slug]?.[op]
        if (!required || !scopes.includes(required)) return false
      }
    }
    return (existing ?? PAYLOAD_DEFAULT_ACCESS)(args)
  }

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
```

**Properties:**

- **UI sessions are never restricted by scopes.** Scopes only apply when the request is authenticated via API key. A tenant admin's web admin session still has full role permissions.
- **Empty scopes = open.** A key with no scopes set behaves like the old behavior (inherits role permissions). Lets existing keys keep working and lets operators opt in gradually.
- **Non-empty scopes = default-deny across the platform.** A key with any scope set is restricted to *only* the `(slug, op)` pairs that scope unlocks — every other collection denies even if role and tenant access would otherwise allow. This is the property that makes scoped keys actually scoped, and it's enforced centrally so adding a new collection doesn't risk a bypass.
- **Composable.** The gate runs *before* the existing `Access` chain (`tenantScopedUpdate`, `withBillingLock`, `denyKioskManager`, etc.) — those still apply after a scope check passes, so tenant isolation and billing lock remain in force.

### 4.3 Wiring — centralized in `payload.config.ts`

Scope enforcement is applied to *every* collection by mapping the array through `withApiKeyScopeEnforcement` at config time. Individual collection files are not modified.

```ts
// src/payload.config.ts
import { withApiKeyScopeEnforcement } from './access/apiScoped'

export default buildConfig({
  collections: [
    PrayerSchedules,
    PrayerDisplayContent,
    Events,
    // ...
  ].map(withApiKeyScopeEnforcement),
  // ...
})
```

This is the critical architectural choice: per-collection wiring would leave a bypass any time a new collection is added without remembering to wrap its access. Central wrapping makes default-deny the default, and adding a new collection to scoped-key access is a one-line `SCOPE_MAP` entry rather than an edit to the collection file.

### 4.4 Migration

Payload will generate a migration for the new `enableAPIKey`, `apiKey`, `apiKeyIndex`, and `apiScopes` columns on the `users` table. This migration must be added to `src/migrations/` and applied as part of the rollout.

### 4.5 Tests

- `src/access/apiScoped.test.ts` unit-tests:
  - UI session (mapped or unmapped collection) → existing access decision passes through.
  - API key, no `apiScopes` field → existing access decision passes through (back-compat).
  - API key, empty `apiScopes` → existing access decision passes through (back-compat).
  - API key, non-empty scopes, **unmapped** collection → denied for every CRUD op, even when existing access would allow. This is the security boundary.
  - API key, non-empty scopes, mapped collection + required scope missing → denied.
  - API key, non-empty scopes, mapped collection + required scope present → existing access decision passes through.
  - Tenant cross-over: scope matches but existing tenant-scoped access denies → still denied (tenant scoping wins).
  - Where-clause returns from existing access are preserved through the gate.
  - Missing existing access function (collection didn't define one) falls back to Payload's default `({ req }) => Boolean(req.user)`.

---

## 5. Permissions matrix

| Caller | Auth strategy | `prayer-times:read` | `prayer-times:write` | Notes |
|---|---|---|---|---|
| `platformOwner` (UI) | session | yes, any tenant | yes, any tenant | scopes don't apply to UI |
| `admin` (UI) | session | own tenant | own tenant (billing lock applies) | scopes don't apply to UI |
| `staff` (UI) | session | per existing `tenantScoped*` | per existing `tenantScoped*` | unchanged |
| `kioskManager` (UI) | session | allowed (read-only via `allowKioskManagerRead`) | denied (`denyKioskManager`) | unchanged |
| Any user via API key, scopes empty | api-key | inherit role | inherit role (billing lock applies) | back-compat behavior |
| Any user via API key, scopes set | api-key | only if scope present **and** role allows **and** tenant matches | only if scope present **and** role allows **and** tenant matches **and** billing OK | the new gate |

`platformOwner` API keys with scopes set are still constrained by those scopes; if a platform owner wants full access via a key, they leave `apiScopes` empty.

---

## 6. The skill itself

### 6.1 Location and shape

```
~/.claude/skills/open-masjid-prayer-times/
└── SKILL.md
```

A single-file skill. No code. The frontmatter activates the skill on:

- The `/masjid` slash command.
- Natural mentions of prayer times, iqamah, Fajr/Zuhr/Asr/Maghrib/Isha in the context of OpenMasjid, or any known tenant slug (`icp`, `celina`, `icpc`).

### 6.2 Required environment

| Variable | Purpose | Required |
|---|---|---|
| `OPENMASJID_API_BASE` | API host, e.g. `http://localhost:3000` | yes (default `http://localhost:3000`) |
| `OPENMASJID_API_KEY` | User API key (`Authorization: users API-Key <value>`) | yes |

If either is missing, the skill must explain how to mint a key (User admin → enable API key → set `apiScopes`) and stop.

### 6.3 Session bootstrap

On first use in a session:

1. `GET /api/users/me` → resolve caller: email, role, tenant, `apiScopes`.
2. If `platformOwner` and no tenant context yet, ask the user "which tenant?" before any read or write.
3. Print one line confirming identity, e.g.:
   ```
   Connected as fajr@icp.org (admin, tenant: icp, scopes: prayer-times:read, prayer-times:write)
   ```

### 6.4 Read flow

Example: "What's Fajr iqamah this week?"

1. Resolve active schedule:
   `GET /api/prayer-schedules?where[tenant][equals]=<id>&where[startDate][less_than_equal]=<today>&where[endDate][greater_than_equal]=<today>&limit=1`
2. Inspect `iqamahRules.fajr` (for the rule) and `days[]` entries for the asked-about window (for resolved times).
3. Answer in plain English. If the rule is `offset`, mention the offset; if `absolute`, mention the absolute time.

### 6.5 Write flow

Example: "Change Fajr to 5:30 AM."

1. **Scope gate.** If `prayer-times:write` is missing from the caller's scopes, refuse cleanly:
   > "Your key is read-only — set the `prayer-times:write` scope on your user (admin → Users → your account → API scopes) to make edits."
2. **Disambiguate via natural questions** (the LLM is expected to ask the right one, not pattern-match):
   - No schedule covers today → "There's no schedule covering today. I can't create one from chat in this version — please add one in the admin UI."
   - One active schedule covering today → "Change for the whole `<Schedule name>` (`<N>` days), or just today?"
     - "Just today" → out of scope (no per-day overrides in v1). Tell the user this is a v2 feature and point them at the admin UI.
   - Multiple overlapping schedules → list them and ask which.
   - The wording is ambiguous (e.g. "earlier" with no number) → ask for the specific time.
3. **Build the PATCH body** containing only the changed subtree, e.g.:
   ```json
   {
     "iqamahRules": {
       "fajr": { "mode": "absolute", "absoluteValue": "5:30 AM" }
     }
   }
   ```
4. **Show a diff preview, wait for explicit yes/no:**
   ```
   Schedule: Spring 2026 (Mar 1 – May 31, 84 days)
   Fajr iqamah rule:
     mode:          absolute (unchanged)
     absoluteValue: 5:45 AM → 5:30 AM
   This will regenerate iqamah times for all 84 days.
   Apply? (yes/no)
   ```
5. On `yes` → `PATCH /api/prayer-schedules/<id>` with the body from step 3.
6. On `no` or anything ambiguous → drop the change, retain no state.

### 6.6 Error handling

| Server response | Skill behavior |
|---|---|
| `401 Unauthorized` | "API key is invalid or revoked. Mint a new one in the admin UI." |
| `403` due to scope check | "Your key doesn't have the `<scope>` scope. Ask your admin to grant it." |
| `403` due to billing lock | "This tenant's billing is locked; edits are blocked until reactivated. Visit Billing in the admin." |
| `403` due to tenant scoping | "This key can't access tenant `<slug>`." |
| `400` validation error | Show Payload's validation message verbatim; offer to retry with a corrected value. |
| Network / 5xx | Surface the raw error; suggest checking the dev server. |

### 6.7 SKILL.md structure (sketch)

1. Frontmatter (`name`, `description`).
2. Setup check — env vars; how to mint a key; how to set scopes.
3. Session bootstrap — `GET /api/users/me` recipe.
4. Read recipes — exact query strings.
5. Write recipes — exact PATCH bodies.
6. Disambiguation playbook — the questions to ask before writing.
7. Diff preview template (the exact format above).
8. Error handling table.
9. Scope guards — the read-only refusal message.

---

## 7. Test strategy

**Automated (covers the platform feature):**

- Unit tests for `isApiKeyAuth` and `gateByApiKeyScope` (cases listed in §4.5).
- No new tests on `PrayerSchedules.ts` beyond compile-time wiring; existing access tests remain.

**Manual (validates the skill):**

A short script the operator runs against a local dev server with a freshly minted API key, walking through:

1. Read with full scopes → answer is correct.
2. Read with `prayer-times:read` only → answer is correct.
3. Write with `prayer-times:read` only → refusal message, no PATCH made.
4. Write with `prayer-times:write` → diff preview, explicit yes/no respected.
5. Write to a tenant the key does not belong to → 403, clean error.
6. Write while tenant is past_due → billing-lock error.

No automated test of the skill itself in v1 — token cost outweighs value for a POC.

---

## 8. MCP: why not, and when to revisit

For v1, the skill is a single SKILL.md, not an MCP server. The reasoning:

- The interesting unknowns in this POC are **prompt-shaped** (when does the LLM ask the right clarifying question? does the diff preview actually reduce mistakes?), not tool-shaped. A prompt iterates faster than a typed tool surface.
- Payload's REST API already provides a typed, validated, access-controlled surface. MCP would be a shim over an existing shim.
- There is one LLM consumer today (Claude Code) and one anticipated tomorrow (Hermes-style in-app bot). If Hermes uses LLM-loaded skill-style instructions like Claude Code does, MCP earns nothing.

**Revisit MCP if any of these become true:**

- The skill grows to include **irreversible operations** where prose-level confirmation feels too soft (deleting members, refunding donations, posting public announcements). MCP can enforce a `previewToken → applyToken` handshake at the protocol level, which prose cannot.
- A second non-LLM consumer appears (CLI, integration, teammate script) — though REST already covers that.
- Hermes turns out to want typed tools rather than skill-style prompts.

---

## 9. File layout — summary of all changes

```
src/collections/Users.ts                                  modified  enable useAPIKey, add apiScopes field
src/payload.config.ts                                     modified  apply withApiKeyScopeEnforcement to every collection
src/access/apiScoped.ts                                   new       isApiKeyAuth + gateByApiKeyScope + withApiKeyScopeEnforcement
src/access/apiScoped.test.ts                              new       unit tests for scope gating (mapped + unmapped collections)
src/migrations/<timestamp>-user-api-scopes.ts             new       Payload-generated migration
docs/superpowers/specs/2026-05-28-open-masjid-prayer-times-skill-design.md   new   this doc
~/.claude/skills/open-masjid-prayer-times/SKILL.md        new       the skill (lives outside repo)
```

---

## 10. Definition of done

- `auth.useAPIKey: true` and the `apiScopes` field are live on `Users`, with a migration applied.
- `isApiKeyAuth`, `gateByApiKeyScope`, and `withApiKeyScopeEnforcement` are implemented and unit-tested per §4.5.
- Every collection in `payload.config.ts` is wrapped with `withApiKeyScopeEnforcement`, so non-empty `apiScopes` is default-deny except for the `(slug, op)` pairs declared in `SCOPE_MAP`.
- The skill exists, activates on `/masjid` and on natural mentions of prayer times, and an operator can chat through a Fajr iqamah change end-to-end with a working diff preview.
- All six manual test cases in §7 pass against a local dev server.
- This spec is committed.
