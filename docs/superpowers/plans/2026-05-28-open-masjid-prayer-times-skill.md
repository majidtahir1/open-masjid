# OpenMasjid Prayer Times Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Claude Code skill (`open-masjid-prayer-times`) that lets an operator edit a tenant's prayer iqamah rules via natural-language chat, backed by a new scoped-API-key feature on `Users`.

**Architecture:** Skill is a single prompt file (`~/.claude/skills/open-masjid-prayer-times/SKILL.md`). It uses `curl` against Payload's existing REST API. Authorization is enforced server-side by a new `requireScope` access wrapper that gates writes by `apiScopes` on the API-key-authenticated user. UI sessions are untouched. Tenant scoping, role checks, and billing lock remain in force.

**Tech Stack:** Payload CMS 3.84.1, Next.js, TypeScript, Vitest, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-05-28-open-masjid-prayer-times-skill-design.md`

---

## File Structure

| File | Purpose | Status |
|---|---|---|
| `src/access/apiScoped.ts` | `isApiKeyAuth(req)` + `requireScope(scope)(existingAccess)` | **new** |
| `src/access/apiScoped.test.ts` | Unit tests for both helpers | **new** |
| `src/collections/Users.ts` | Enable `auth.useAPIKey`; add `apiScopes` field | modify |
| `src/collections/PrayerSchedules.ts` | Wrap `access.{read,create,update,delete}` with `requireScope` | modify |
| `src/migrations/<timestamp>_user_api_scopes.ts` + `.json` | Payload-generated migration | **new** (generated) |
| `~/.claude/skills/open-masjid-prayer-times/SKILL.md` | The skill prompt | **new** (outside repo) |

`requireScope` is the only new abstraction. It's a higher-order `Access` function that composes cleanly with `tenantScopedRead`, `withBillingLock`, `denyKioskManager`, etc.

---

## Task 1: Add `isApiKeyAuth` helper with tests

**Files:**
- Create: `src/access/apiScoped.ts`
- Create: `src/access/apiScoped.test.ts`

**Context:** Payload sets `user._strategy = 'api-key'` when a request authenticates via the `Authorization: users API-Key <value>` header (see `node_modules/payload/dist/auth/strategies/apiKey.js:49`). For session auth, `_strategy` is `'local-jwt'`. That marker is the only thing we need to distinguish the two.

- [ ] **Step 1: Write the failing test file**

Create `src/access/apiScoped.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'

import { isApiKeyAuth } from './apiScoped'

const reqWith = (user: Record<string, unknown> | null): PayloadRequest =>
  ({ user } as unknown as PayloadRequest)

describe('isApiKeyAuth', () => {
  it('returns false when there is no user', () => {
    expect(isApiKeyAuth(reqWith(null))).toBe(false)
  })

  it('returns false for session-authenticated users', () => {
    expect(isApiKeyAuth(reqWith({ id: 1, _strategy: 'local-jwt' }))).toBe(false)
  })

  it('returns true for api-key-authenticated users', () => {
    expect(isApiKeyAuth(reqWith({ id: 1, _strategy: 'api-key' }))).toBe(true)
  })

  it('returns false when _strategy is missing', () => {
    expect(isApiKeyAuth(reqWith({ id: 1 }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/access/apiScoped.test.ts`
Expected: FAIL — `Cannot find module './apiScoped'`.

- [ ] **Step 3: Implement `isApiKeyAuth`**

Create `src/access/apiScoped.ts`:

```ts
import type { PayloadRequest } from 'payload'

type UserWithStrategy = { _strategy?: string } | null | undefined

export const isApiKeyAuth = (req: PayloadRequest): boolean => {
  const user = req.user as UserWithStrategy
  return user?._strategy === 'api-key'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/access/apiScoped.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/access/apiScoped.ts src/access/apiScoped.test.ts
git commit -m "feat(access): add isApiKeyAuth helper

Detects API-key-authenticated requests via Payload's req.user._strategy
marker. First piece of the scoped API-key feature."
```

---

## Task 2: Add `requireScope` higher-order access helper with tests

**Files:**
- Modify: `src/access/apiScoped.ts`
- Modify: `src/access/apiScoped.test.ts`

**Context:** `requireScope('foo:write')(existingAccess)` returns a new `Access` function that:

1. If the request is **not** API-key auth → defers entirely to `existingAccess` (UI sessions are never restricted by scopes).
2. If the request **is** API-key auth and the user has no `apiScopes` set (or it's an empty array) → defers to `existingAccess` (back-compat for keys minted before scopes).
3. If the request is API-key auth and `apiScopes` is set but doesn't include the required scope → return `false` (deny).
4. Otherwise → defer to `existingAccess`.

Tenant scoping and billing lock are preserved because they live in `existingAccess`.

- [ ] **Step 1: Write the failing tests**

Append to `src/access/apiScoped.test.ts`:

```ts
import { requireScope } from './apiScoped'
import type { Access } from 'payload'

const allow: Access = () => true
const allowOwnTenant: Access = ({ req }) => {
  const user = req.user as { tenant?: string } | null
  if (!user) return false
  return { tenant: { equals: user.tenant } } as unknown as ReturnType<Access>
}
const deny: Access = () => false

const argsFor = (req: PayloadRequest): Parameters<Access>[0] =>
  ({ req } as unknown as Parameters<Access>[0])

describe('requireScope', () => {
  const guard = requireScope('prayer-times:write')

  it('passes through to existing access for UI sessions (no scope check)', () => {
    const access = guard(allow)
    const req = reqWith({ id: 1, _strategy: 'local-jwt', apiScopes: [] })
    expect(access(argsFor(req))).toBe(true)
  })

  it('passes through for UI sessions even when existing access denies', () => {
    const access = guard(deny)
    const req = reqWith({ id: 1, _strategy: 'local-jwt' })
    expect(access(argsFor(req))).toBe(false)
  })

  it('passes through for API key auth with empty scopes (back-compat)', () => {
    const access = guard(allow)
    const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: [] })
    expect(access(argsFor(req))).toBe(true)
  })

  it('passes through for API key auth with no apiScopes field (back-compat)', () => {
    const access = guard(allow)
    const req = reqWith({ id: 1, _strategy: 'api-key' })
    expect(access(argsFor(req))).toBe(true)
  })

  it('passes through for API key auth when scope is present', () => {
    const access = guard(allow)
    const req = reqWith({
      id: 1,
      _strategy: 'api-key',
      apiScopes: ['prayer-times:read', 'prayer-times:write'],
    })
    expect(access(argsFor(req))).toBe(true)
  })

  it('denies for API key auth when scope is missing', () => {
    const access = guard(allow)
    const req = reqWith({
      id: 1,
      _strategy: 'api-key',
      apiScopes: ['prayer-times:read'],
    })
    expect(access(argsFor(req))).toBe(false)
  })

  it('still denies when scope is present but existing access denies (tenant scoping wins)', () => {
    const access = guard(deny)
    const req = reqWith({
      id: 1,
      _strategy: 'api-key',
      apiScopes: ['prayer-times:write'],
    })
    expect(access(argsFor(req))).toBe(false)
  })

  it('preserves where-clause returns from existing access', () => {
    const access = guard(allowOwnTenant)
    const req = reqWith({
      id: 1,
      _strategy: 'api-key',
      apiScopes: ['prayer-times:write'],
      tenant: 'abc',
    })
    expect(access(argsFor(req))).toEqual({ tenant: { equals: 'abc' } })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/access/apiScoped.test.ts`
Expected: FAIL — `requireScope` not exported.

- [ ] **Step 3: Implement `requireScope`**

Append to `src/access/apiScoped.ts`:

```ts
import type { Access } from 'payload'

type UserWithScopes = { apiScopes?: string[] } & UserWithStrategy

export const requireScope =
  (scope: string) =>
  (existing: Access): Access =>
  (args) => {
    const { req } = args
    const user = req.user as UserWithScopes
    if (user && isApiKeyAuth(req)) {
      const scopes = (user.apiScopes ?? []) as string[]
      if (scopes.length > 0 && !scopes.includes(scope)) return false
    }
    return existing(args)
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/access/apiScoped.test.ts`
Expected: PASS (all 12 tests — 4 from Task 1 + 8 new).

- [ ] **Step 5: Commit**

```bash
git add src/access/apiScoped.ts src/access/apiScoped.test.ts
git commit -m "feat(access): add requireScope higher-order access wrapper

Gates an existing Access function by an apiScopes value on the
authenticated user. UI sessions and empty-scope API keys pass through
unchanged; API keys with a non-empty scope list must include the
required scope. Composes with tenantScoped* and withBillingLock."
```

---

## Task 3: Enable API keys and add `apiScopes` field on Users

**Files:**
- Modify: `src/collections/Users.ts` (auth block at line 54, fields array at line 221)

**Context:** Payload's `auth.useAPIKey: true` adds three columns to the users table: `enableAPIKey`, `apiKey`, `apiKeyIndex`. We also add `apiScopes` as a `select` with `hasMany: true`. Field is conditionally visible when `enableAPIKey` is true. Empty-by-default keeps back-compat.

- [ ] **Step 1: Modify the auth block to enable API keys**

In `src/collections/Users.ts`, locate the `auth:` block at line 54 and add `useAPIKey: true`:

```ts
  auth: {
    depth: 0,
    useAPIKey: true,
    forgotPassword: {
      // ... existing forgotPassword config unchanged
```

- [ ] **Step 2: Add the `apiScopes` field after the existing `tenant` field**

In `src/collections/Users.ts`, find the `tenant` field (starts line 289). After its closing `},` (the field's outer closer), insert a new field. The current structure after the tenant field continues with other fields; insert `apiScopes` immediately after the tenant field's closing brace:

```ts
    {
      name: 'apiScopes',
      type: 'select',
      hasMany: true,
      label: 'API scopes',
      defaultValue: [],
      options: [
        { label: 'Prayer times — read', value: 'prayer-times:read' },
        { label: 'Prayer times — write', value: 'prayer-times:write' },
      ],
      admin: {
        description:
          "Restricts what this user's API key can do. Leave empty to inherit the user's full role permissions. UI session permissions are never restricted by this field.",
        condition: (data) => Boolean(data?.enableAPIKey),
      },
    },
```

If you cannot uniquely locate the tenant field's closing brace via grep, open the file and find the structural boundary: the tenant field starts at `{ name: 'tenant', ...` (around line 289) and ends where the next field begins or the `fields: [` array closes. Insert `apiScopes` immediately after the tenant field's outermost `},`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no errors).

- [ ] **Step 4: Regenerate Payload types**

Run: `npm run generate:types`
Expected: `src/payload-types.ts` updates to include `apiScopes?: ('prayer-times:read' | 'prayer-times:write')[] | null` on the `User` type.

- [ ] **Step 5: Generate the migration**

Run: `npm run payload migrate:create -- --name user_api_scopes`
Expected: Two new files in `src/migrations/`: a `<timestamp>_user_api_scopes.ts` and `.json` capturing the new columns (`enableAPIKey`, `apiKey`, `apiKeyIndex`, `apiScopes`).

If the command name differs in this codebase, check `package.json` scripts. The general form is `payload migrate:create`.

- [ ] **Step 6: Apply the migration to the local database**

Run: `npm run payload migrate`
Expected: migration succeeds; new columns exist on `users` table.

- [ ] **Step 7: Smoke-test in the admin UI**

Run: `npm run dev`

In a browser, go to `localhost:3000/admin/collections/users`, open your user, and verify:
- An "API Key" section appears with an "Enable API Key" toggle.
- Toggling Enable API Key on reveals the API key field and the new "API scopes" field.
- The scopes field offers exactly two options: `Prayer times — read`, `Prayer times — write`.
- Saving with one or both scopes selected persists correctly.

Stop the dev server (`Ctrl-C`) when done.

- [ ] **Step 8: Commit**

```bash
git add src/collections/Users.ts src/payload-types.ts src/migrations/
git commit -m "feat(users): enable API keys with scoped permissions

Adds useAPIKey to the Users auth config and a new apiScopes select
field (prayer-times:read, prayer-times:write). Empty apiScopes
preserves existing role-based access for back-compat. Includes the
generated migration for the new users columns."
```

---

## Task 4: Wire `requireScope` into `PrayerSchedules` access controls

**Files:**
- Modify: `src/collections/PrayerSchedules.ts` (access block at lines 105–110)

**Context:** Existing access composition is `denyKioskManager(withBillingLock(tenantScopedX))` for writes and `allowKioskManagerRead(tenantScopedRead)` for reads. We wrap the outermost layer with `requireScope`. Order matters: `requireScope` runs first (so a scope-less key short-circuits), then the existing chain runs (so a key with the right scope is still constrained by tenant/billing/role).

- [ ] **Step 1: Add the import**

In `src/collections/PrayerSchedules.ts`, after the existing access imports (the `tenantScopedX` and `withBillingLock` lines near the top), add:

```ts
import { requireScope } from '../access/apiScoped'
```

- [ ] **Step 2: Wrap the access block**

Replace the current access block (lines 105–110):

```ts
  access: {
    read: allowKioskManagerRead(tenantScopedRead),
    create: denyKioskManager(withBillingLock(tenantScopedCreate)),
    update: denyKioskManager(withBillingLock(tenantScopedUpdate)),
    delete: denyKioskManager(withBillingLock(tenantScopedDelete)),
  },
```

With:

```ts
  access: {
    read: requireScope('prayer-times:read')(allowKioskManagerRead(tenantScopedRead)),
    create: requireScope('prayer-times:write')(denyKioskManager(withBillingLock(tenantScopedCreate))),
    update: requireScope('prayer-times:write')(denyKioskManager(withBillingLock(tenantScopedUpdate))),
    delete: requireScope('prayer-times:write')(denyKioskManager(withBillingLock(tenantScopedDelete))),
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS. No existing tests should regress (UI sessions are unaffected by scopes).

- [ ] **Step 5: Commit**

```bash
git add src/collections/PrayerSchedules.ts
git commit -m "feat(prayer-schedules): gate access by API-key scopes

Wraps the existing tenant/billing/kiosk access chain with requireScope.
API keys must have prayer-times:read for GET and prayer-times:write
for create/update/delete. UI sessions are unaffected."
```

---

## Task 5: Write the `open-masjid-prayer-times` skill

**Files:**
- Create: `~/.claude/skills/open-masjid-prayer-times/SKILL.md`

**Context:** This file lives outside the repo. It is a single Markdown file with YAML frontmatter that activates the skill on `/masjid` and on natural mentions of prayer-time topics. The file is purely instructional — Claude reads it and follows the recipes.

- [ ] **Step 1: Create the skill directory**

Run: `mkdir -p ~/.claude/skills/open-masjid-prayer-times`
Expected: directory exists.

- [ ] **Step 2: Write SKILL.md**

Create `~/.claude/skills/open-masjid-prayer-times/SKILL.md` with this exact content:

````markdown
---
name: open-masjid-prayer-times
description: Edit a tenant's prayer iqamah rules in OpenMasjid via natural language. Use when the user mentions prayer times, iqamah, Fajr/Zuhr/Asr/Maghrib/Isha in the context of OpenMasjid, an OpenMasjid tenant slug (e.g. icp, celina, icpc), or invokes /masjid.
---

# OpenMasjid Prayer Times Skill

Edit a tenant's prayer iqamah rules by chatting in natural language. This skill talks to a running OpenMasjid instance via Payload's REST API using a scoped API key.

## Environment

Required environment variables:

- `OPENMASJID_API_BASE` — API host. Default: `http://localhost:3000`.
- `OPENMASJID_API_KEY` — User API key. Mint one at `<base>/admin/collections/users`, edit your user, toggle "Enable API Key," set `apiScopes`, and save. Send as: `Authorization: users API-Key <key>`.

If either is missing, tell the user how to set them and stop.

## Session bootstrap (do this once per session, on first use)

1. `GET $OPENMASJID_API_BASE/api/users/me` with the auth header.
2. Parse the returned user. Note: `email`, `role`, `tenant` (id), `apiScopes`.
3. If `role === 'platformOwner'` and the user has not specified a tenant, ask which tenant before any read or write. Resolve the tenant slug to an id with `GET /api/tenants?where[slug][equals]=<slug>&limit=1`.
4. Print one confirmation line, e.g.:
   `Connected as fajr@icp.org (admin, tenant: icp, scopes: prayer-times:read, prayer-times:write)`

## Reading prayer times

For "what's Fajr iqamah this week?" / "what time is Maghrib today?" / similar:

1. Resolve today's date in `YYYY-MM-DD` (use the local date).
2. Find the active schedule:
   ```
   GET /api/prayer-schedules
     ?where[tenant][equals]=<tenant-id>
     &where[startDate][less_than_equal]=<today>
     &where[endDate][greater_than_equal]=<today>
     &limit=1
     &depth=0
   ```
3. From the returned doc:
   - `iqamahRules.<prayer>` describes the rule (mode: `absolute` with `absoluteValue`, or `offset` with `offsetMinutes`).
   - `days[]` contains the resolved per-day `adhan` and `iqamah` strings; filter by `date`.
4. Answer in plain English.

If the result list is empty, say "there's no schedule covering today" — do not invent times.

## Writing iqamah rules

Trigger phrases: "change Fajr to 5:30 AM", "set Maghrib to adhan + 10 min", "move Isha back to 9:00 PM", etc.

### Scope gate

If `prayer-times:write` is missing from the caller's scopes (cached from session bootstrap), refuse cleanly and stop:

> Your API key is read-only — it doesn't have the `prayer-times:write` scope. Ask your admin to grant it (Users → your account → API scopes), then mint a new key.

Do not attempt the PATCH.

### Disambiguation playbook

Ask the right clarifying question; do not pattern-match. Examples:

- **No active schedule covers today.** Reply:
  > There's no prayer schedule covering today. Creating a new schedule isn't supported via chat in this version — please add one in the admin UI under Prayer → Schedules.
  Stop.

- **One active schedule, user said "today" or "just today".** Reply:
  > Per-day overrides aren't supported via chat in this version. The change has to apply to the whole schedule (`<name>`, `<N>` days) or you can override a single day in the admin UI. Apply to the whole schedule, or cancel?

- **One active schedule, user said "from now on" / no scope hint.** Confirm scope:
  > That will change the rule for the whole `<schedule name>` schedule (`<N>` days, `<startDate>` to `<endDate>`). Sound right, or did you mean a different schedule?

- **Multiple overlapping schedules.** List them with their date ranges and ask which.

- **Ambiguous time.** ("earlier", "a bit later") Ask for the specific time.

- **Offset vs absolute ambiguity.** If user says "5 minutes after adhan", that's `offset`. If user says "5:30 AM", that's `absolute`. Don't assume — confirm if unclear.

### Build the PATCH

Only send the changed subtree. Example for "change Fajr to 5:30 AM":

```json
{
  "iqamahRules": {
    "fajr": { "mode": "absolute", "absoluteValue": "5:30 AM" }
  }
}
```

Example for "set Maghrib to adhan + 10":

```json
{
  "iqamahRules": {
    "maghrib": { "mode": "offset", "offsetMinutes": 10 }
  }
}
```

### Diff preview — ALWAYS show before sending

Format:

```
Schedule: <name> (<startDate> – <endDate>, <N> days)
<Prayer> iqamah rule:
  mode:          <old> → <new>     (or "unchanged")
  absoluteValue: <old> → <new>     (only if mode is absolute)
  offsetMinutes: <old> → <new>     (only if mode is offset)
This will regenerate iqamah times for all <N> days.
Apply? (yes/no)
```

Wait for an explicit "yes" or equivalent affirmative. On "no", "cancel", or anything ambiguous, drop the change and confirm nothing was sent.

### Send the PATCH

```
PATCH $OPENMASJID_API_BASE/api/prayer-schedules/<id>
Authorization: users API-Key $OPENMASJID_API_KEY
Content-Type: application/json

<body from above>
```

Then `GET` the schedule again and show the user one resolved day from `days[]` so they can see the new iqamah time, confirming the regenerate hook fired.

## Error handling

| Response | Say |
|---|---|
| `401 Unauthorized` | Your API key is invalid or revoked. Mint a new one in the admin UI. |
| `403`, scope-related | Your key doesn't have the `<scope>` scope. Ask your admin to grant it. |
| `403`, billing lock | This tenant's billing is locked; edits are blocked until reactivated. Visit Billing in the admin. |
| `403`, tenant scoping | This key can't access tenant `<slug>`. |
| `400` validation error | Show Payload's `errors[].message` verbatim and offer to retry with a corrected value. |
| Network / 5xx | Surface the error; suggest checking the dev server. |

If the 403 body doesn't tell you which guard fired, fall back to the generic: "Access denied. Likely causes: missing scope, wrong tenant, or billing lock."

## Hard rules

- Never write without showing the diff preview and getting an explicit yes.
- Never invent a schedule id, tenant id, or time — always resolve from the API.
- Never PATCH `days[]` directly; only modify `iqamahRules` and let the server's autoRegeneratePrayerDays hook recompute.
- Never store the API key anywhere; read it from env each call.
- If the user asks for something out of v1 scope (per-day overrides, Jummah edits, schedule creation, announcements, events, members), politely say it's not supported in this version and point at the admin UI.
````

- [ ] **Step 3: Verify the skill loads**

In a new Claude Code session in this repo, type `/help` and confirm `/masjid` appears in the slash-command list, or mention "open-masjid prayer times" in chat and confirm the skill is offered. (If the slash-command form doesn't surface automatically, the description-triggered activation still works.)

No commit step — the skill lives outside the repo.

---

## Task 6: Manual end-to-end validation

**Files:** none.

**Context:** Walk through all six manual cases from §7 of the spec. This is the only validation that catches prompt-quality regressions.

- [ ] **Step 1: Boot the dev server**

Run: `npm run dev`
Expected: server up at `localhost:3000`. Leave it running through this task.

- [ ] **Step 2: Mint two API keys**

In the admin UI at `localhost:3000/admin/collections/users`:

1. Open your own user (admin or platformOwner). Enable API Key, set `apiScopes` to **both** `prayer-times:read` and `prayer-times:write`, save. Copy the key. Call this `FULL_KEY`.
2. Open the same user (or a second test user), regenerate or note a second key. Set `apiScopes` to **only** `prayer-times:read`. Call this `READ_KEY`. (If Payload only allows one key per user, use a separate test user, or revoke and re-mint between scenarios.)

- [ ] **Step 3: Verify case 1 — read with full scopes**

In a fresh Claude Code session with `OPENMASJID_API_KEY=$FULL_KEY` exported:

> "What time is Fajr iqamah today?"

Expected: skill bootstraps, fetches active schedule, reports the iqamah time correctly.

- [ ] **Step 4: Verify case 2 — read with read-only key**

With `OPENMASJID_API_KEY=$READ_KEY`:

> "What time is Maghrib iqamah today?"

Expected: same correct answer. Confirm the skill's bootstrap line shows only `prayer-times:read`.

- [ ] **Step 5: Verify case 3 — write attempt with read-only key (must refuse)**

Still with `READ_KEY`:

> "Change Fajr to 5:30 AM."

Expected: skill refuses with the "your key is read-only" message. **No PATCH is made.** Confirm by checking the schedule still has the old `iqamahRules.fajr` value (re-read it).

- [ ] **Step 6: Verify case 4 — write with full scopes, diff preview, confirm**

With `FULL_KEY`:

> "Change Fajr iqamah to 5:30 AM."

Expected:
1. Skill resolves the active schedule.
2. Shows the diff preview with old → new value and the day count.
3. Asks "Apply? (yes/no)".
4. On "yes", sends the PATCH.
5. Re-reads and confirms the new resolved iqamah time for today.

Verify in the admin UI that `iqamahRules.fajr.absoluteValue === '5:30 AM'` and `days[]` has been regenerated (Payload's hook fires automatically).

- [ ] **Step 7: Verify case 5 — cross-tenant access denied**

If you have access to a second tenant: mint a key on a user in tenant A, then try to PATCH a schedule belonging to tenant B by id.

Expected: 403, surfaced as "This key can't access tenant `<slug>`." Skip this case if you don't have a second tenant locally; note it as deferred.

- [ ] **Step 8: Verify case 6 — billing lock**

If feasible, set the tenant's billing status to `past_due` directly in the DB (or via Stripe webhook), then try a write with `FULL_KEY`.

Expected: 403, surfaced as the billing-lock message. Restore billing status afterward. Skip if local Stripe state makes this fiddly; note as deferred.

- [ ] **Step 9: Verify case "cancel" path**

With `FULL_KEY`:

> "Change Isha to 9:15 PM."

When the diff preview asks "Apply? (yes/no)", answer "no".

Expected: skill confirms nothing was changed. Re-read the schedule and verify `iqamahRules.isha` is unchanged.

- [ ] **Step 10: Verify out-of-scope refusal**

With `FULL_KEY`:

> "Set just Friday's Asr iqamah to 4:00 PM."

Expected: skill explains per-day overrides aren't supported in this version and points at the admin UI. No PATCH made.

- [ ] **Step 11: Stop the dev server**

`Ctrl-C` in the dev server terminal.

- [ ] **Step 12: Record results**

Note which cases passed, which were deferred, and any prompt issues observed (e.g. skill skipped the diff preview, misread a scope, made up a schedule id). Tighten the SKILL.md wording for any rough edges and re-run the affected case.

No commit step — manual validation only.

---

## Self-review notes

Coverage check against spec:

- §2 in-scope reads/writes → Tasks 4 (server gate), 5 (skill recipes), 6 (validation).
- §4.1 schema → Task 3.
- §4.2 enforcement helper → Tasks 1–2.
- §4.3 wiring → Task 4.
- §4.4 migration → Task 3 (steps 5–6).
- §4.5 tests → Tasks 1–2 cover every case listed.
- §5 permissions matrix → covered by §4.5 tests + Task 6 manual checks.
- §6 skill → Task 5 (matches §6.1–6.7 structure: setup, bootstrap, read, write, diff, errors, hard rules).
- §7 manual test plan → Task 6 walks all six listed cases.

No placeholders. All file paths concrete. All code blocks complete. Cases 5 and 6 in Task 6 are conditional on local data availability and explicitly marked deferrable.
