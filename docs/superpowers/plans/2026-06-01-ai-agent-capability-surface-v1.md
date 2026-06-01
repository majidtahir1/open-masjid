# AI Agent — Capability Surface v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the API-key scope system so the AI assistant (Ansari) can read/write announcements, forms, and events, and read members and signup counts — beyond today's prayer-times-only surface.

**Architecture:** This is a backend-only change. The whole capability surface is data-model + access wiring: (1) add per-entity scope *options* to `User.apiScopes`, and (2) add per-collection `(op → required-scope)` entries to `SCOPE_MAP` in `src/access/apiScoped.ts`. The existing `withApiKeyScopeEnforcement` wrapper (already applied to every collection in `payload.config.ts`) does the enforcement — no new endpoints, hooks, or collections. The agent-side UX (diff-then-confirm, disambiguation, flyer→event parsing) lives in the Hermes VM agent and the prayer-times skill pattern, which are **out of scope for this repo's plan**.

**Why everything here is reachable over standard REST:** Payload auto-generates REST CRUD at `/api/<slug>` for every collection (none disable endpoints), and that path runs through each collection's `access` functions — which is exactly where `withApiKeyScopeEnforcement` hooks in. So adding a scope to `SCOPE_MAP` immediately makes the matching `/api/<slug>` calls reachable for the agent's API key (auth: `Authorization: users API-Key <key>`, already enabled via `enableAPIKey` on Users). Writes (`POST`/`PATCH /api/announcements|forms|events`) and reads/counts (`GET /api/members?…&limit=0` → `totalDocs`, `GET /api/form-submissions?where[form]=…&limit=0` → `totalDocs`) all work over plain REST once scoped.

**Donations deferred to v1.1:** The spec lists donations *read* (totals by fund/month, building-fund progress). Payload REST has **no SUM / group-by**, so this can't be answered over standard REST — it needs a small custom aggregation endpoint (e.g. `GET /api/donations/summary`, DB-level sum, scope-gated by `donations:read`, mirroring the existing `/api/apply-iqamah-rules` pattern). There is also **no `goal`/`target` field** on funds, so "progress" can only ever mean "total raised," not "% of goal." Both are out of scope for this permissions pass and tracked for v1.1; **no `donations:read` scope is added here.**

**Tech Stack:** Payload CMS 3.x (collections + `Access` functions), TypeScript, Vitest. Verification commands: `npm run test`, `npm run lint`, `npm run generate:types`, `npx tsc --noEmit`.

---

## Background: how enforcement works today

`src/access/apiScoped.ts` defines `gateByApiKeyScope(slug, op)` with **default-deny** semantics for API keys carrying a non-empty `apiScopes` array:

- UI sessions (`_strategy !== 'api-key'`) are never restricted.
- API keys with empty/missing `apiScopes` defer to role-based access (back-compat).
- API keys with non-empty `apiScopes`: the `(slug, op)` pair must be in `SCOPE_MAP` **and** the required scope string must be present, else **deny** — even if the role would allow it.
- When scope passes, control still defers to the existing access fn, so tenant scoping + billing lock + role checks all still apply on top.

`SCOPE_MAP` today only maps `prayer-schedules`. `User.apiScopes` options today are only `prayer-times:read` / `prayer-times:write`. The generated union in `src/payload-types.ts:1585` mirrors those two options and must be regenerated when options change.

## Scope mapping decisions (locked in for v1)

| Collection slug | read scope | create/update/delete scope | Rationale |
|---|---|---|---|
| `announcements` | `announcements:read` | `announcements:write` | Post/edit/expire notices. |
| `forms` | `forms:read` | `forms:write` | Create RSVP/forms; read response summaries. |
| `form-submissions` | `forms:read` | *(none — writes stay role-denied)* | Signup counts + response summaries live here, gated under `forms:read`. |
| `events` | `events:read` | `events:write` | Create/update/cancel events. |
| `members` | `members:read` | *(none — read-only in v1)* | Count, new-this-month, search. |
| ~~`donations`~~ | *(deferred → v1.1)* | — | Totals need a custom sum endpoint; see "Donations deferred" above. |
| ~~`donation-funds`~~ | *(deferred → v1.1)* | — | Only meaningful alongside the donations summary endpoint. |

Notes that the implementing engineer must respect:
- **Event signup counts require `forms:read`**, not `events:read` — there is no form relationship on the `events` collection; submissions live in `form-submissions` (mapped to `forms:read`). An agent key that needs event signup counts will carry both `events:read` and `forms:read`.
- **`form-submissions` create/update/delete are already `() => false` at the role level** (`src/collections/FormSubmissions.ts:30-33`). We deliberately leave those ops out of `SCOPE_MAP` so a scoped key is also default-denied them. Only `read` is mapped.
- **`members:read` returns full member documents** (including email, phone, Stripe IDs) — the same data an admin sees in the UI. Field-level PII redaction is **not** done in v1 (resolves the spec's open question: collection-level scope is sufficient for v1; the agent layer is responsible for not echoing Stripe IDs into chat). Because `Members` role-access denies `staff` entirely (`src/collections/Members.ts:37`), the agent's API-key user must be `admin` or `platformOwner` for `members:read` to return data — scopes can only narrow, never widen, role access.
- **Donations are NOT mapped in this pass** — deferred to v1.1 with its summary endpoint (see "Donations deferred" above). No `donations:read` option is added to `User.apiScopes` and no `donations`/`donation-funds` entries are added to `SCOPE_MAP`.
- **No dry-run/preview endpoint** (resolves the spec's other open question): the agent's own confirm step plus server-side validation (`validateSchema` on forms, Payload field validation) is sufficient for v1.
- **No `media` scope in v1**: the flyer→event flow parses the image to text and creates a text/template event; it does not upload the raw flyer. If raw-flyer upload is later wanted, that's a separate `media:write` addition.

---

## File Structure

- **Modify `src/collections/Users.ts`** (~322–336): add 7 new options to the `apiScopes` select (announcements R/W, forms R/W, events R/W, members R). Single responsibility: declares which scope strings a key may hold.
- **Modify `src/access/apiScoped.ts`** (`SCOPE_MAP`, ~27–34): add 5 new collection entries (`announcements`, `forms`, `form-submissions`, `events`, `members`). Single responsibility: maps `(slug, op)` → required scope.
- **Modify `src/access/apiScoped.test.ts`**: move existing `'events'` unmapped-fixture cases to a still-unmapped collection (`'pages'`), then add coverage for every new mapping.
- **Regenerate `src/payload-types.ts`**: `apiScopes` union (line 1585) auto-updates via `npm run generate:types`. Do not hand-edit.
- **Update `docs/superpowers/specs/2026-05-31-ai-agent-capability-surface-v1-design.md`**: flip Status to "Implemented", record the two open-question resolutions.

---

## Task 1: Add per-entity scope options to `User.apiScopes`

**Files:**
- Modify: `src/collections/Users.ts:327-330` (the `options` array)
- Regenerate: `src/payload-types.ts`

- [ ] **Step 1: Add the new options**

In `src/collections/Users.ts`, replace the `options` array of the `apiScopes` field (currently the two prayer-times entries at lines 327–330) with:

```ts
      options: [
        { label: 'Prayer times — read', value: 'prayer-times:read' },
        { label: 'Prayer times — write', value: 'prayer-times:write' },
        { label: 'Announcements — read', value: 'announcements:read' },
        { label: 'Announcements — write', value: 'announcements:write' },
        { label: 'Forms & submissions — read', value: 'forms:read' },
        { label: 'Forms — write', value: 'forms:write' },
        { label: 'Events — read', value: 'events:read' },
        { label: 'Events — write', value: 'events:write' },
        { label: 'Members — read', value: 'members:read' },
      ],
```

(Donations is intentionally omitted — deferred to v1.1.)

- [ ] **Step 2: Regenerate Payload types**

Run: `npm run generate:types`
Expected: exits 0; `src/payload-types.ts:1585` now reads:
`apiScopes?: ('prayer-times:read' | 'prayer-times:write' | 'announcements:read' | 'announcements:write' | 'forms:read' | 'forms:write' | 'events:read' | 'events:write' | 'members:read')[] | null;`

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Users.ts src/payload-types.ts
git commit -m "feat(agent): add per-entity API-key scope options for announcements, forms, events, members"
```

---

## Task 2: Move existing unmapped-collection fixtures off `events`

`src/access/apiScoped.test.ts` uses `'events'` as its example of an **unmapped** collection in several cases (lines 47, 53, 61, 67, 137, 142, 149). Task 3 maps `events`, which would silently invalidate those cases. Move them to `'pages'` (which stays unmapped in v1) **first**, while `SCOPE_MAP` is unchanged, so the suite stays green throughout.

**Files:**
- Modify: `src/access/apiScoped.test.ts`
- Test: `src/access/apiScoped.test.ts` (same file)

- [ ] **Step 1: Confirm the suite is green before changes**

Run: `npm run test -- src/access/apiScoped.test.ts`
Expected: PASS (all existing cases green).

- [ ] **Step 2: Replace the `'events'` unmapped fixtures with `'pages'`**

In `src/access/apiScoped.test.ts`, change every occurrence of `gateByApiKeyScope('events', ...)` to `gateByApiKeyScope('pages', ...)`. There are 7 occurrences. Also update the surrounding test titles that say "unmapped collection" — they remain accurate for `pages`. The affected blocks become:

```ts
    it('passes through to existing access for a UI session, unmapped collection', () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('still defers to existing access when it denies (UI), unmapped collection', () => {
      const access = gateByApiKeyScope('pages', 'update')(deny)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(false)
    })
```

```ts
    it('defers to existing access for API key with no apiScopes field, unmapped collection', () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'api-key' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('defers to existing access for API key with empty apiScopes, unmapped collection', () => {
      const access = gateByApiKeyScope('pages', 'update')(allow)
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: [] })
      expect(access(argsFor(req))).toBe(true)
    })
```

```ts
    it('allows authed UI user when no existing access is provided', () => {
      const access = gateByApiKeyScope('pages', 'read')(undefined)
      const req = reqWith({ id: 1, _strategy: 'local-jwt' })
      expect(access(argsFor(req))).toBe(true)
    })

    it('denies anonymous request when no existing access is provided', () => {
      const access = gateByApiKeyScope('pages', 'read')(undefined)
      const req = reqWith(null)
      expect(access(argsFor(req))).toBe(false)
    })

    it('denies scoped key on unmapped collection regardless of missing existing access', () => {
      const access = gateByApiKeyScope('pages', 'update')(undefined)
      const req = reqWith({ id: 1, _strategy: 'api-key', apiScopes: ['prayer-times:read'] })
      expect(access(argsFor(req))).toBe(false)
    })
```

Leave the `'carousel-slides'` case (the "denies unmapped collection for every CRUD op" block) as-is — it is already a safe unmapped fixture.

- [ ] **Step 3: Run the suite to confirm still green**

Run: `npm run test -- src/access/apiScoped.test.ts`
Expected: PASS (same count as Step 1; behavior unchanged since `pages` and `events` are both unmapped right now).

- [ ] **Step 4: Commit**

```bash
git add src/access/apiScoped.test.ts
git commit -m "test(agent): move unmapped-collection fixtures from events to pages ahead of events scope mapping"
```

---

## Task 3: Extend `SCOPE_MAP` with the new collection mappings (TDD)

**Files:**
- Modify: `src/access/apiScoped.ts:27-34` (`SCOPE_MAP`)
- Test: `src/access/apiScoped.test.ts`

- [ ] **Step 1: Write the failing tests**

Append this block inside the top-level `describe('gateByApiKeyScope', ...)` in `src/access/apiScoped.test.ts`, just before its closing `})`:

```ts
  describe('v1 capability-surface mappings', () => {
    const keyWith = (scopes: string[]) =>
      reqWith({ id: 1, _strategy: 'api-key', apiScopes: scopes })

    // [slug, op, requiredScope] — the scope that must be present to pass.
    const allowCases: Array<[string, 'read' | 'create' | 'update' | 'delete', string]> = [
      ['announcements', 'read', 'announcements:read'],
      ['announcements', 'create', 'announcements:write'],
      ['announcements', 'update', 'announcements:write'],
      ['announcements', 'delete', 'announcements:write'],
      ['forms', 'read', 'forms:read'],
      ['forms', 'create', 'forms:write'],
      ['forms', 'update', 'forms:write'],
      ['forms', 'delete', 'forms:write'],
      ['form-submissions', 'read', 'forms:read'],
      ['events', 'read', 'events:read'],
      ['events', 'create', 'events:write'],
      ['events', 'update', 'events:write'],
      ['events', 'delete', 'events:write'],
      ['members', 'read', 'members:read'],
    ]

    for (const [slug, op, scope] of allowCases) {
      it(`allows ${op} on ${slug} when key has ${scope}`, () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(access(argsFor(keyWith([scope])))).toBe(true)
      })

      it(`denies ${op} on ${slug} when key lacks ${scope}`, () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        // a non-empty but irrelevant scope set → default-deny
        expect(access(argsFor(keyWith(['prayer-times:read'])))).toBe(false)
      })
    }

    // Read scope must NOT grant writes.
    const readDoesNotGrantWrite: Array<[string, 'create' | 'update' | 'delete', string]> = [
      ['announcements', 'create', 'announcements:read'],
      ['forms', 'update', 'forms:read'],
      ['events', 'delete', 'events:read'],
    ]
    for (const [slug, op, readScope] of readDoesNotGrantWrite) {
      it(`denies ${op} on ${slug} when key only has ${readScope}`, () => {
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(access(argsFor(keyWith([readScope])))).toBe(false)
      })
    }

    // Read-only collections expose no write mapping → scoped keys are denied writes.
    const readOnlyWriteDenied: Array<[string, 'create' | 'update' | 'delete']> = [
      ['members', 'create'],
      ['members', 'update'],
      ['members', 'delete'],
      ['form-submissions', 'create'],
      ['form-submissions', 'update'],
      ['form-submissions', 'delete'],
    ]
    for (const [slug, op] of readOnlyWriteDenied) {
      it(`denies ${op} on read-only ${slug} even with that domain's read scope`, () => {
        const readScope = slug === 'form-submissions' ? 'forms:read' : `${slug}:read`
        const access = gateByApiKeyScope(slug, op)(allow)
        expect(access(argsFor(keyWith([readScope])))).toBe(false)
      })
    }

    it('preserves a where-clause return from existing access on a newly mapped collection', () => {
      const access = gateByApiKeyScope('members', 'read')(allowOwnTenant)
      const req = keyWith(['members:read'])
      ;(req.user as { tenant?: string }).tenant = 'abc'
      expect(access(argsFor(req))).toEqual({ tenant: { equals: 'abc' } })
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/access/apiScoped.test.ts`
Expected: FAIL — the "allows ..." cases fail (every new `(slug, op)` is still unmapped, so `gateByApiKeyScope` returns `false` instead of `true`). The "denies ..." cases will pass.

- [ ] **Step 3: Implement the `SCOPE_MAP` entries**

In `src/access/apiScoped.ts`, replace the `SCOPE_MAP` constant (lines 27–34) with:

```ts
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
  // NOTE: donations / donation-funds are intentionally NOT mapped here.
  // Donation Q&A (totals by fund/month) needs a custom sum endpoint that
  // Payload REST can't provide — deferred to v1.1.
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/access/apiScoped.test.ts`
Expected: PASS — all cases green (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/access/apiScoped.ts src/access/apiScoped.test.ts
git commit -m "feat(agent): map announcements, forms, events, members to API-key scopes"
```

---

## Task 4: Update the spec doc and run full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-05-31-ai-agent-capability-surface-v1-design.md`

- [ ] **Step 1: Update the spec status and resolve open questions**

In `docs/superpowers/specs/2026-05-31-ai-agent-capability-surface-v1-design.md`, change the Status line (line 4) to:

```markdown
- **Status:** Implemented (backend scopes) — see [plan](../plans/2026-06-01-ai-agent-capability-surface-v1.md)
```

Replace the `## Open questions` section (lines 79–83) with:

```markdown
## Open questions (resolved in implementation)

- **Dry-run/preview endpoint for create flows?** No — the agent's own confirm step plus server-side validation (`validateSchema` on forms, Payload field validation) is sufficient for v1. No new endpoint added.
- **Members search PII?** `members:read` returns full member documents at the collection level (same data an admin sees in the UI); field-level redaction is deferred. The agent layer must avoid echoing Stripe IDs into chat. Because `Members` role-access denies `staff`, the agent key's user must be `admin`/`platformOwner` for reads to return data.
- **Event signup counts** flow through `form-submissions` (gated by `forms:read`), since events have no form relationship field; an agent key needing them carries both `events:read` and `forms:read`.

**Deferred to v1.1:** Donations read (`donations:read`). Payload REST has no SUM/group-by, so "totals by fund/month" and "building-fund progress" need a custom aggregation endpoint (`GET /api/donations/summary`, DB-level sum, scope-gated, mirroring `/api/apply-iqamah-rules`). There is also no `goal`/`target` field on funds, so "progress" would mean "total raised," not "% of goal." Tracked separately.
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: PASS — all suites green.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exits 0, no errors in `src/access/apiScoped.ts`, `src/access/apiScoped.test.ts`, `src/collections/Users.ts`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-05-31-ai-agent-capability-surface-v1-design.md
git commit -m "docs(agent): mark capability-surface v1 implemented; resolve open questions"
```

---

## Self-Review

**Spec coverage:**
- Per-entity scope model (`announcements/forms/events:read|write`, `members:read`) → Task 1 (options) + Task 3 (`SCOPE_MAP`). ✅
- "Reads require `:read`, writes require `:write`; default-deny stays" → Task 3 tests assert allow-with-scope, deny-without, and read-does-not-grant-write. ✅
- Announcements/forms/events writes; members read-only → Task 3 maps writes only for the first three, read-only for members; `readOnlyWriteDenied` cases assert no write leakage. ✅
- Forms/RSVP signup counts + response summary → `form-submissions` read mapped to `forms:read`. ✅
- Donations campaign/building-fund progress → **deferred to v1.1** (needs a custom sum endpoint; no native REST aggregation, no goal field). Documented in Task 4 + plan header. ✅ (intentional gap)
- "Tenant scoping + billing lock unchanged, still apply on top" → unchanged; `preserves where-clause` test confirms existing access still governs. ✅
- Open questions → resolved in Task 4. ✅
- Out-of-scope items (kiosk control, advanced prayer writes, donations read/write, multi-tenant key productization, media upload) → deliberately not mapped; documented. ✅

**Placeholder scan:** No TBD/TODO/"add validation"/"similar to" — every step has concrete code or an exact command. ✅

**Type/identifier consistency:** Scope strings used in `User.apiScopes` options (Task 1) exactly match the required-scope values in `SCOPE_MAP` (Task 3) and the test `allowCases` (Task 3): `announcements:read|write`, `forms:read|write`, `events:read|write`, `members:read`. Collection slugs match the codebase: `announcements`, `forms`, `form-submissions`, `events`, `members`. No `donations:read` / `donations` / `donation-funds` references remain anywhere in the plan (deferred to v1.1). ✅
