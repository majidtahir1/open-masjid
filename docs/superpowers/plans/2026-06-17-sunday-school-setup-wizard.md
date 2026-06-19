# Sunday School Setup Wizard & Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six raw Sunday-school collection nav links with a single "Sunday School" hub plus a step-by-step setup wizard (Term → Classes → Teachers → Students) that makes the data relationships obvious.

**Architecture:** Two custom admin routes (`/admin/sunday-school` hub, `/admin/sunday-school/setup` wizard) built like the existing `take-attendance` and `membership/overview` pages — server components that role-gate and render inside `DefaultTemplate`, with client components doing REST CRUD against the existing six collections. No new persistence: wizard progress is derived from data via pure helpers. The six collections are hidden from the nav (`admin.hidden: true`) but stay URL-reachable. The invite endpoint is extended to allow inviting `teacher`.

**Tech Stack:** Payload CMS 3.84, Next.js App Router, React client components, TypeScript, Vitest.

---

## Context the implementer needs

- **Custom admin route pattern:** read `src/app/(payload)/admin/take-attendance/page.tsx` (server gate + `DefaultTemplate`) and `src/app/(payload)/admin/membership/overview/page.tsx` (server summary load via `getPayload` + `createLocalReq` + `importMap`). Copy these patterns exactly.
- **Nav component pattern:** `src/admin/school/SundaySchoolNav.tsx` (async server component, `getAdminUser`, role `Set`, returns `<Link className="nav__link">`).
- **REST CRUD from client:** `src/admin/school/TakeAttendance.tsx` already has a working `api()` fetch helper and Payload `where[...]` query syntax. Task 2 extracts it to a shared module.
- **importMap:** any component referenced by string path in `payload.config.ts` must be in `src/app/(payload)/admin/importMap.js`. Regenerate with `npx payload generate:importmap` and COMMIT the result (a stale importMap 404s the nav link in prod builds — this exact bug already happened once on this branch).
- **Collections live behind a migration** — schema changes require `npx payload migrate` (auto-push is off). This plan adds NO collection fields, so no migration is needed.

---

## File Structure

```
src/endpoints/inviteUser.ts          ← MODIFY: extract pure authorizeInvite(), allow teacher/school_admin
src/lib/school-setup.ts              ← CREATE: pure firstIncompleteStep() + buildHubSummary()
src/admin/school/api.ts              ← CREATE: shared REST api() helper (extracted from TakeAttendance)
src/admin/school/TakeAttendance.tsx  ← MODIFY: import shared api()
src/admin/school/SundaySchoolNav.tsx ← MODIFY: repoint to /admin/sunday-school
src/admin/school/HubClient.tsx       ← CREATE: hub dashboard view
src/admin/school/SetupWizard.tsx     ← CREATE: client stepper
src/admin/school/steps/StepTerm.tsx
src/admin/school/steps/StepClasses.tsx
src/admin/school/steps/StepTeachers.tsx
src/admin/school/steps/StepStudents.tsx
src/app/(payload)/admin/sunday-school/page.tsx        ← CREATE: hub server route
src/app/(payload)/admin/sunday-school/setup/page.tsx  ← CREATE: wizard server route
src/collections/{Terms,SchoolClasses,Students,Enrollments,ClassSessions,AttendanceRecords}.ts ← MODIFY: admin.hidden true
tests/endpoints/inviteUser.authorize.test.ts          ← CREATE
tests/lib/school-setup.test.ts                        ← CREATE
```

---

## Task 1: Extend invite endpoint to allow teacher invites

**Files:**
- Modify: `src/endpoints/inviteUser.ts`
- Test: `tests/endpoints/inviteUser.authorize.test.ts`

Extract the authorization decision into a pure function so it can be unit-tested without Payload, then widen it to allow inviting `teacher`/`school_admin`.

- [ ] **Step 1: Write the failing test**

Create `tests/endpoints/inviteUser.authorize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { authorizeInvite } from '@/endpoints/inviteUser'

describe('authorizeInvite', () => {
  it('rejects callers who are not platformOwner/admin/school_admin', () => {
    expect(authorizeInvite({ actingRole: 'staff', actingTenant: 1 }, { role: 'teacher', tenant: 1 }).ok).toBe(false)
    expect(authorizeInvite({ actingRole: 'teacher', actingTenant: 1 }, { role: 'teacher', tenant: 1 }).ok).toBe(false)
  })
  it('platformOwner can invite any role, forcing tenant null for platformOwner target', () => {
    expect(authorizeInvite({ actingRole: 'platformOwner', actingTenant: null }, { role: 'admin', tenant: 5 })).toEqual({
      ok: true,
      targetTenant: 5,
    })
    expect(authorizeInvite({ actingRole: 'platformOwner', actingTenant: null }, { role: 'platformOwner', tenant: 5 })).toEqual({
      ok: true,
      targetTenant: null,
    })
  })
  it('admin and school_admin can invite teacher/staff into THEIR OWN tenant (ignoring supplied tenant)', () => {
    for (const actingRole of ['admin', 'school_admin'] as const) {
      expect(authorizeInvite({ actingRole, actingTenant: 7 }, { role: 'teacher', tenant: 99 })).toEqual({
        ok: true,
        targetTenant: 7,
      })
      expect(authorizeInvite({ actingRole, actingTenant: 7 }, { role: 'staff', tenant: 99 })).toEqual({
        ok: true,
        targetTenant: 7,
      })
    }
  })
  it('admin and school_admin CANNOT invite elevated roles', () => {
    for (const actingRole of ['admin', 'school_admin'] as const) {
      for (const role of ['platformOwner', 'admin', 'school_admin'] as const) {
        const r = authorizeInvite({ actingRole, actingTenant: 7 }, { role, tenant: 7 })
        expect(r.ok).toBe(false)
        expect(r.status).toBe(403)
      }
    }
  })
  it('admin/school_admin with no tenant is rejected', () => {
    expect(authorizeInvite({ actingRole: 'admin', actingTenant: null }, { role: 'teacher', tenant: 1 }).ok).toBe(false)
  })
  it('missing role is a 400', () => {
    const r = authorizeInvite({ actingRole: 'platformOwner', actingTenant: null }, { role: undefined, tenant: 1 })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/endpoints/inviteUser.authorize.test.ts`
Expected: FAIL — `authorizeInvite` is not exported.

- [ ] **Step 3: Refactor the endpoint to expose `authorizeInvite`**

In `src/endpoints/inviteUser.ts`:

a) Widen the `InviteBody` role union:
```ts
type InviteRole = 'platformOwner' | 'admin' | 'staff' | 'kioskManager' | 'teacher' | 'school_admin'
type InviteBody = {
  email?: string
  role?: InviteRole
  tenant?: string | number | null
  firstName?: string
  lastName?: string
}
```

b) Add the pure authorization function (above the handler):
```ts
type ActingCtx = { actingRole?: string; actingTenant: string | number | null }
type InviteDecision =
  | { ok: true; targetTenant: string | number | null }
  | { ok: false; error: string; status: number }

/** Elevated roles only platformOwner may grant. */
const ELEVATED_ROLES = new Set(['platformOwner', 'admin', 'school_admin'])
const SELF_SERVE_INVITERS = new Set(['platformOwner', 'admin', 'school_admin'])

/**
 * Pure authorization decision for an invite. No Payload access.
 * - platformOwner: any role; platformOwner target gets tenant null, others use supplied tenant.
 * - admin / school_admin: may invite only teacher/staff/kioskManager, forced into their own tenant.
 */
export function authorizeInvite(
  ctx: ActingCtx,
  body: { role?: string; tenant?: string | number | null },
): InviteDecision {
  if (!ctx.actingRole || !SELF_SERVE_INVITERS.has(ctx.actingRole)) {
    return { ok: false, error: 'Forbidden', status: 403 }
  }
  if (!body.role) return { ok: false, error: 'email and role are required', status: 400 }

  if (ctx.actingRole === 'platformOwner') {
    return { ok: true, targetTenant: body.role === 'platformOwner' ? null : (body.tenant ?? null) }
  }

  // admin or school_admin
  if (ELEVATED_ROLES.has(body.role)) {
    return { ok: false, error: `You cannot invite ${body.role}.`, status: 403 }
  }
  if (!ctx.actingTenant) {
    return { ok: false, error: 'Your account has no tenant; cannot invite.', status: 400 }
  }
  return { ok: true, targetTenant: ctx.actingTenant }
}
```

c) Rewire the handler to use it. Replace the role-guard + tenant-restriction block (from the `if (user.role !== 'platformOwner' ...)` check through the `if (role !== 'platformOwner' && !targetTenant)` block) with:

```ts
  const body = ((await req.json?.()) ?? {}) as InviteBody
  const { email, role, firstName = '', lastName = '' } = body

  if (!email) return Response.json({ error: 'email and role are required' }, { status: 400 })

  const decision = authorizeInvite(
    { actingRole: user.role, actingTenant: extractId((user as { tenant?: unknown }).tenant) },
    { role, tenant: body.tenant ?? null },
  )
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status })
  const targetTenant = decision.targetTenant

  // Demo-tenant guard (only applies when inviting into a concrete tenant).
  if (user.role !== 'platformOwner' && targetTenant) {
    const actingTenant = await payload.findByID({ collection: 'tenants', id: targetTenant, overrideAccess: true })
    if (isDemoTenant(actingTenant as { demoMode?: boolean | null })) {
      return Response.json({ error: 'Invites are disabled for the demo tenant.' }, { status: 403 })
    }
  }
```

Keep the rest of the handler (existing-user check, create, forgotPassword) unchanged, but ensure the `payload.create` uses `tenant: role === 'platformOwner' ? null : (targetTenant as number)` (already the case).

- [ ] **Step 4: Run the test + full suite + typecheck**

Run: `npx vitest run tests/endpoints/inviteUser.authorize.test.ts` → PASS.
Run: `npm test` → all pass. Run `npx tsc --noEmit` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/inviteUser.ts tests/endpoints/inviteUser.authorize.test.ts
git commit -m "feat(school): allow admin/school_admin to invite teachers"
```

---

## Task 2: Pure setup helpers + shared REST client

**Files:**
- Create: `src/lib/school-setup.ts`
- Create: `src/admin/school/api.ts`
- Modify: `src/admin/school/TakeAttendance.tsx` (use shared `api()`)
- Test: `tests/lib/school-setup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/school-setup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { firstIncompleteStep, buildHubSummary } from '@/lib/school-setup'

describe('firstIncompleteStep', () => {
  it('no active term → step 1', () => {
    expect(firstIncompleteStep({ term: null, classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 })).toBe(1)
  })
  it('term but no classes → step 2', () => {
    expect(firstIncompleteStep({ term: { id: 1 }, classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 } as any)).toBe(2)
  })
  it('classes but unplaced students remain → step 4', () => {
    expect(firstIncompleteStep({ term: { id: 1 }, classCount: 2, teacherlessCount: 0, placedCount: 1, unplacedCount: 3 } as any)).toBe(4)
  })
  it('classes and nothing unplaced → done (5)', () => {
    expect(firstIncompleteStep({ term: { id: 1 }, classCount: 2, teacherlessCount: 1, placedCount: 4, unplacedCount: 0 } as any)).toBe(5)
  })
  it('never auto-lands on the skippable Teachers step (3)', () => {
    for (const unplaced of [0, 2]) {
      expect(firstIncompleteStep({ term: { id: 1 }, classCount: 1, teacherlessCount: 1, placedCount: 0, unplacedCount: unplaced } as any)).not.toBe(3)
    }
  })
})

describe('buildHubSummary', () => {
  it('counts classes, teacherless classes, placed and unplaced students', () => {
    const term = { id: 1, name: 'Fall 2026', startDate: '2026-09-06', endDate: '2026-11-29', meetingDay: 'sunday' }
    const classes = [
      { id: 11, teachers: [{ id: 9 }] },
      { id: 12, teachers: [] },
      { id: 13 }, // no teachers field
    ]
    const enrollments = [
      { student: 201, status: 'active' },
      { student: { id: 202 }, status: 'active' },
      { student: 203, status: 'withdrawn' },
    ]
    const students = [{ id: 201 }, { id: 202 }, { id: 203 }, { id: 204 }]
    const summary = buildHubSummary({ term, classes, enrollments, students, sessionsPerClass: 12 })
    expect(summary.classCount).toBe(3)
    expect(summary.teacherlessCount).toBe(2) // classes 12 and 13
    expect(summary.placedCount).toBe(2) // 201, 202 active
    expect(summary.unplacedCount).toBe(2) // 203 (withdrawn≠placed) and 204 never enrolled
    expect(summary.term?.name).toBe('Fall 2026')
    expect(summary.term?.sessionsPerClass).toBe(12)
  })
  it('null term yields zero counts', () => {
    const s = buildHubSummary({ term: null, classes: [], enrollments: [], students: [], sessionsPerClass: 0 })
    expect(s).toEqual({ term: null, classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/lib/school-setup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/school-setup.ts`:

```ts
export interface HubTerm {
  id: string | number
  name: string
  startDate?: string | null
  endDate?: string | null
  meetingDay?: string | null
  sessionsPerClass: number
}

export interface HubSummary {
  term: HubTerm | null
  classCount: number
  teacherlessCount: number
  placedCount: number
  unplacedCount: number
}

const idOf = (v: unknown): string | number =>
  typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

/**
 * Which wizard step to resume at. Never returns 3 (Teachers) — that step is
 * skippable, so it must never block resume. Returns 5 when setup is complete.
 */
export function firstIncompleteStep(s: HubSummary): 1 | 2 | 4 | 5 {
  if (!s.term) return 1
  if (s.classCount === 0) return 2
  if (s.unplacedCount > 0) return 4
  return 5
}

interface RawDocs {
  term: {
    id: string | number
    name: string
    startDate?: string | null
    endDate?: string | null
    meetingDay?: string | null
  } | null
  classes: Array<{ id: string | number; teachers?: unknown[] }>
  enrollments: Array<{ student: unknown; status?: string }>
  students: Array<{ id: string | number }>
  sessionsPerClass: number
}

/** Pure aggregation of raw docs into the hub summary. */
export function buildHubSummary(raw: RawDocs): HubSummary {
  if (!raw.term) {
    return { term: null, classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 }
  }
  const teacherlessCount = raw.classes.filter((c) => !c.teachers || c.teachers.length === 0).length
  const placedIds = new Set(
    raw.enrollments.filter((e) => e.status === 'active').map((e) => String(idOf(e.student))),
  )
  const placedCount = placedIds.size
  const unplacedCount = raw.students.filter((st) => !placedIds.has(String(st.id))).length
  return {
    term: {
      id: raw.term.id,
      name: raw.term.name,
      startDate: raw.term.startDate ?? null,
      endDate: raw.term.endDate ?? null,
      meetingDay: raw.term.meetingDay ?? null,
      sessionsPerClass: raw.sessionsPerClass,
    },
    classCount: raw.classes.length,
    teacherlessCount,
    placedCount,
    unplacedCount,
  }
}
```

- [ ] **Step 4: Extract the shared REST helper**

Create `src/admin/school/api.ts` (lifted verbatim from the `api` function currently inside `TakeAttendance.tsx`):

```ts
'use client'

/** Fetch wrapper for Payload REST under the logged-in admin session. */
export async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}
```

Then in `src/admin/school/TakeAttendance.tsx`, delete the local `api` function definition and add at the top: `import { api } from './api'`. Leave all call sites unchanged.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/lib/school-setup.test.ts` → PASS. `npm test` → all pass. `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/school-setup.ts src/admin/school/api.ts src/admin/school/TakeAttendance.tsx tests/lib/school-setup.test.ts
git commit -m "feat(school): pure setup helpers + shared REST client"
```

---

## Task 3: Hide collections from nav + repoint the nav link

**Files:**
- Modify: `src/collections/Terms.ts`, `SchoolClasses.ts`, `Students.ts`, `Enrollments.ts`, `ClassSessions.ts`, `AttendanceRecords.ts`
- Modify: `src/admin/school/SundaySchoolNav.tsx`

- [ ] **Step 1: Hide each collection from the nav**

In each of the six collection files, in the `admin` block, change `hidden: hideForKioskManager` to `hidden: true`. (The `hideForKioskManager` import becomes unused — remove it from that file's import line, keeping `denyKioskManager`.) Access functions are unchanged; `hidden` only affects nav, and the collection routes remain reachable by URL.

Example for `Terms.ts` — the admin block becomes:
```ts
  admin: {
    enableListViewSelectAPI: true,
    group: 'Sunday School',
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'endDate', 'meetingDay', 'status'],
    description: 'Academic periods for the Sunday school (e.g. "Fall 2026").',
  },
```
And the import line becomes `import { denyKioskManager } from '../access/kioskRoles'`.

Apply the identical `hidden: true` change (and remove the now-unused `hideForKioskManager` import) to all six files.

- [ ] **Step 2: Repoint the nav link to the hub**

In `src/admin/school/SundaySchoolNav.tsx`, change the link `href` and label:
```tsx
      <Link
        className="nav__link"
        href="/admin/sunday-school"
        data-sunday-school-nav-link
      >
        Sunday School
      </Link>
```
Leave the `ALLOWED_ROLES` set and the tenant-guard logic unchanged (platformOwner/admin/school_admin/teacher still see it).

- [ ] **Step 3: Typecheck + suite**

Run `npx tsc --noEmit` (no unused-import errors) and `npm test` (all pass).

- [ ] **Step 4: Commit**

```bash
git add src/collections/Terms.ts src/collections/SchoolClasses.ts src/collections/Students.ts src/collections/Enrollments.ts src/collections/ClassSessions.ts src/collections/AttendanceRecords.ts src/admin/school/SundaySchoolNav.tsx
git commit -m "feat(school): hide raw collections from nav; point nav to hub"
```

---

## Task 4: Hub route + HubClient

**Files:**
- Create: `src/app/(payload)/admin/sunday-school/page.tsx`
- Create: `src/admin/school/HubClient.tsx`

- [ ] **Step 1: Create the hub server route**

Create `src/app/(payload)/admin/sunday-school/page.tsx`. Model it on `membership/overview/page.tsx` (read that file first for the exact import shape of `DefaultTemplate`, `createLocalReq`, `importMap`, `getAdminUser`, `loginUrl`).

```tsx
import { redirect } from 'next/navigation'
import { createLocalReq, getPayload } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { getAdminUser } from '@/lib/admin-context'
import { loginUrl } from '@/lib/login-redirect'
import { importMap } from '../importMap'
import HubClient from '@/admin/school/HubClient'
import { buildHubSummary } from '@/lib/school-setup'
import { weeklyDates } from '@/hooks/generateClassSessions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HUB_ROLES = new Set(['platformOwner', 'admin', 'school_admin', 'teacher'])

const idOf = (v: unknown): string | number | null =>
  v == null ? null : typeof v === 'object' && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

export default async function SundaySchoolHubPage() {
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl('/admin/sunday-school'))
  const role = (user as { role?: string }).role
  if (!role || !HUB_ROLES.has(role)) redirect('/admin')

  const payload = await getPayload({ config })
  const req = await createLocalReq({ user }, payload)
  const tenantId = idOf((user as { tenant?: unknown }).tenant)

  // Active term (most recent active for this tenant).
  const termRes = await payload.find({
    collection: 'terms',
    where: { status: { equals: 'active' }, ...(tenantId ? { tenant: { equals: tenantId } } : {}) },
    sort: '-startDate',
    limit: 1,
    depth: 0,
    req,
  })
  const term = termRes.docs[0] ?? null

  let classes: any[] = []
  let enrollments: any[] = []
  let students: any[] = []
  let sessionsPerClass = 0
  if (term) {
    classes = (await payload.find({ collection: 'school-classes', where: { term: { equals: term.id } }, limit: 1000, depth: 0, req })).docs
    const classIds = classes.map((c) => c.id)
    if (classIds.length) {
      enrollments = (await payload.find({ collection: 'enrollments', where: { class: { in: classIds } }, limit: 5000, depth: 0, req })).docs
    }
    students = (await payload.find({ collection: 'students', where: { status: { equals: 'active' } }, limit: 5000, depth: 0, req })).docs
    sessionsPerClass = term.startDate && term.endDate ? weeklyDates(term.startDate, term.endDate, term.meetingDay ?? 'sunday').length : 0
  }

  const summary = buildHubSummary({ term, classes, enrollments, students, sessionsPerClass })

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={req.locale as never}
      params={Promise.resolve({ segments: ['sunday-school'] })}
      payload={payload}
      permissions={permissions as never}
      searchParams={Promise.resolve({})}
      user={user as never}
      visibleEntities={{ collections: [], globals: [] } as never}
      importMap={importMap}
    >
      <HubClient summary={summary} canSetup={role !== 'teacher'} />
    </DefaultTemplate>
  )
}
```

> If `DefaultTemplate`'s required props differ in this Payload version, copy them EXACTLY from `membership/overview/page.tsx` (it renders successfully today). Adjust the prop list to match that file rather than the above if there is any mismatch.

- [ ] **Step 2: Create the hub client view**

Create `src/admin/school/HubClient.tsx`:

```tsx
'use client'
import React from 'react'
import Link from 'next/link'
import type { HubSummary } from '@/lib/school-setup'
import { firstIncompleteStep } from '@/lib/school-setup'

const tile: React.CSSProperties = { border: '1px solid var(--theme-elevation-150)', borderRadius: 8, padding: '12px 16px', minWidth: 140 }

const HubClient: React.FC<{ summary: HubSummary; canSetup: boolean }> = ({ summary, canSetup }) => {
  const resume = firstIncompleteStep(summary)
  return (
    <div style={{ padding: '1.5rem', maxWidth: 880 }}>
      <h1>Sunday School</h1>
      <p style={{ color: 'var(--theme-elevation-600)' }}>
        A <strong>Term</strong> holds <strong>Classes</strong>. Each class meets weekly —{' '}
        <strong>Sessions are created automatically</strong> from the term&apos;s dates. Students enroll into classes.
      </p>

      {summary.term ? (
        <div style={{ ...tile, minWidth: 'auto', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{summary.term.name}</h2>
          <p style={{ margin: '4px 0 0' }}>
            {summary.term.sessionsPerClass} weekly sessions auto-created
            {summary.term.startDate && summary.term.endDate
              ? ` (${String(summary.term.startDate).slice(0, 10)} → ${String(summary.term.endDate).slice(0, 10)})`
              : ''}
          </p>
        </div>
      ) : (
        <div style={{ ...tile, minWidth: 'auto', marginBottom: 16 }}>
          <p style={{ margin: 0 }}>No term set up yet.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={tile}><strong>{summary.classCount}</strong><br />classes</div>
        <div style={tile}><strong>{summary.teacherlessCount}</strong><br />without a teacher</div>
        <div style={tile}><strong>{summary.placedCount}</strong><br />students placed</div>
        <div style={tile}>
          <strong>{summary.unplacedCount}</strong><br />
          {summary.unplacedCount > 0 && canSetup ? (
            <Link href="/admin/sunday-school/setup?step=4">unplaced →</Link>
          ) : ('unplaced')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {canSetup && (
          <Link className="btn btn--style-primary btn--size-medium" href={`/admin/sunday-school/setup?step=${summary.term ? resume : 1}`}>
            {summary.term ? 'Continue setup' : 'Start setup'}
          </Link>
        )}
        <Link className="btn btn--style-secondary btn--size-medium" href="/admin/take-attendance">
          Take attendance
        </Link>
      </div>
    </div>
  )
}

export default HubClient
```

- [ ] **Step 3: Typecheck + manual smoke**

Run `npx tsc --noEmit` (clean). Boot dev (`timeout 90 npm run dev`), confirm `/admin/sunday-school` compiles (grep log for errors). Full E2E needs seeded data — not required here.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(payload)/admin/sunday-school/page.tsx" src/admin/school/HubClient.tsx
git commit -m "feat(school): Sunday school hub page"
```

---

## Task 5: Wizard shell with resumable steps

**Files:**
- Create: `src/app/(payload)/admin/sunday-school/setup/page.tsx`
- Create: `src/admin/school/SetupWizard.tsx`

- [ ] **Step 1: Create the wizard server route**

Create `src/app/(payload)/admin/sunday-school/setup/page.tsx` — same gating as the hub but restricted to setup roles (teacher redirected to the hub):

```tsx
import { redirect } from 'next/navigation'
import { createLocalReq, getPayload } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { getAdminUser } from '@/lib/admin-context'
import { loginUrl } from '@/lib/login-redirect'
import { importMap } from '../../importMap'
import SetupWizard from '@/admin/school/SetupWizard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SETUP_ROLES = new Set(['platformOwner', 'admin', 'school_admin'])

export default async function SundaySchoolSetupPage() {
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl('/admin/sunday-school/setup'))
  const role = (user as { role?: string }).role
  if (!role || !SETUP_ROLES.has(role)) redirect('/admin/sunday-school')

  const payload = await getPayload({ config })
  const req = await createLocalReq({ user }, payload)

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={req.locale as never}
      params={Promise.resolve({ segments: ['sunday-school', 'setup'] })}
      payload={payload}
      permissions={permissions as never}
      searchParams={Promise.resolve({})}
      user={user as never}
      visibleEntities={{ collections: [], globals: [] } as never}
      importMap={importMap}
    >
      <SetupWizard />
    </DefaultTemplate>
  )
}
```

> Match `DefaultTemplate` props to `membership/overview/page.tsx` if they differ.

- [ ] **Step 2: Create the stepper shell**

Create `src/admin/school/SetupWizard.tsx`. It loads the active term + counts on mount, computes the resume step (unless `?step=` overrides), renders a step bar, and mounts the active step. The four step components are created in Tasks 6–7; import them now (create empty placeholder step files first if needed so this compiles — but Tasks 6–7 will replace them).

```tsx
'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from './api'
import { buildHubSummary, firstIncompleteStep, type HubSummary } from '@/lib/school-setup'
import StepTerm from './steps/StepTerm'
import StepClasses from './steps/StepClasses'
import StepTeachers from './steps/StepTeachers'
import StepStudents from './steps/StepStudents'

const STEPS = ['Term', 'Classes', 'Teachers', 'Students'] as const

async function loadSummary(): Promise<{ summary: HubSummary; termId: string | number | null }> {
  const termRes = await api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0')
  const term = termRes.docs[0] ?? null
  if (!term) return { summary: buildHubSummary({ term: null, classes: [], enrollments: [], students: [], sessionsPerClass: 0 }), termId: null }
  const classes = (await api(`/school-classes?where[term][equals]=${term.id}&limit=1000&depth=0`)).docs
  const classIds = classes.map((c: any) => c.id)
  const enrollments = classIds.length
    ? (await api(`/enrollments?where[class][in]=${classIds.join(',')}&limit=5000&depth=0`)).docs
    : []
  const students = (await api('/students?where[status][equals]=active&limit=5000&depth=0')).docs
  const summary = buildHubSummary({ term, classes, enrollments, students, sessionsPerClass: 0 })
  return { summary, termId: term.id }
}

const SetupWizard: React.FC = () => {
  const router = useRouter()
  const params = useSearchParams()
  const [step, setStep] = useState<number>(0)
  const [ready, setReady] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let active = true
    loadSummary().then(({ summary }) => {
      if (!active) return
      const qs = params.get('step')
      const resume = qs ? Number(qs) : firstIncompleteStep(summary)
      // step bar is 1-indexed in URL; clamp 5(done) → Students(4)
      setStep(Math.min(Math.max(resume, 1), 4))
      setReady(true)
    })
    return () => { active = false }
  }, [params, reloadKey])

  const goto = (s: number) => {
    setStep(s)
    router.replace(`/admin/sunday-school/setup?step=${s}`)
  }

  if (!ready) return <div style={{ padding: '1.5rem' }}>Loading…</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880 }}>
      <h1>Set up Sunday School</h1>
      <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, marginBottom: 24 }}>
        {STEPS.map((label, i) => {
          const n = i + 1
          return (
            <li key={label}>
              <button
                onClick={() => goto(n)}
                style={{ fontWeight: step === n ? 700 : 400, textDecoration: step === n ? 'underline' : 'none' }}
              >
                {n}. {label}
              </button>
            </li>
          )
        })}
      </ol>

      {step === 1 && <StepTerm onNext={() => goto(2)} onChanged={refresh} />}
      {step === 2 && <StepClasses onBack={() => goto(1)} onNext={() => goto(3)} onChanged={refresh} />}
      {step === 3 && <StepTeachers onBack={() => goto(2)} onNext={() => goto(4)} />}
      {step === 4 && <StepStudents onBack={() => goto(3)} onFinish={() => router.push('/admin/sunday-school')} onChanged={refresh} />}
    </div>
  )
}

export default SetupWizard
```

- [ ] **Step 3: Create placeholder step files so this compiles**

Create the four files under `src/admin/school/steps/` with minimal placeholder content (replaced in Tasks 6–7), e.g. `StepTerm.tsx`:
```tsx
'use client'
import React from 'react'
const StepTerm: React.FC<{ onNext: () => void; onChanged: () => void }> = () => <div>Term step</div>
export default StepTerm
```
Create analogous placeholders: `StepClasses` (`{ onBack; onNext; onChanged }`), `StepTeachers` (`{ onBack; onNext }`), `StepStudents` (`{ onBack; onFinish; onChanged }`). Match these exact prop names — Tasks 6–7 rely on them.

- [ ] **Step 4: Typecheck + commit**

Run `npx tsc --noEmit` (clean) and `npm test` (all pass).
```bash
git add "src/app/(payload)/admin/sunday-school/setup/page.tsx" src/admin/school/SetupWizard.tsx src/admin/school/steps/
git commit -m "feat(school): setup wizard shell with resumable steps"
```

---

## Task 6: Step 1 (Term) and Step 2 (Classes)

**Files:**
- Modify: `src/admin/school/steps/StepTerm.tsx`
- Modify: `src/admin/school/steps/StepClasses.tsx`

- [ ] **Step 1: Implement StepTerm**

Replace `src/admin/school/steps/StepTerm.tsx`:

```tsx
'use client'
import React, { useEffect, useState } from 'react'
import { api } from '../api'

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const StepTerm: React.FC<{ onNext: () => void; onChanged: () => void }> = ({ onNext, onChanged }) => {
  const [term, setTerm] = useState<any>(null)
  const [name, setName] = useState('')
  const [startDate, setStart] = useState('')
  const [endDate, setEnd] = useState('')
  const [meetingDay, setDay] = useState('sunday')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0').then((r) => {
      const t = r.docs[0]
      if (t) {
        setTerm(t); setName(t.name ?? ''); setStart(String(t.startDate ?? '').slice(0, 10))
        setEnd(String(t.endDate ?? '').slice(0, 10)); setDay(t.meetingDay ?? 'sunday')
      }
    }).catch(() => {})
  }, [])

  const save = async () => {
    setBusy(true); setError('')
    try {
      const data = { name, startDate, endDate, meetingDay, status: 'active' }
      const saved = term
        ? await api(`/terms/${term.id}`, { method: 'PATCH', body: JSON.stringify(data) }).then((r) => r.doc)
        : await api('/terms', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      setTerm(saved)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2>1. Term</h2>
      <p>Name, dates, and weekly meeting day. Sessions are generated automatically for every class in this term.</p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
        <label>Name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall 2026" /></label>
        <label>Start <input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
        <label>End <input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>Meeting day{' '}
          <select value={meetingDay} onChange={(e) => setDay(e.target.value)}>
            {WEEKDAYS.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </label>
      </div>
      {error && <p style={{ color: 'var(--theme-error-500)' }}>{error}</p>}
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button className="btn btn--style-secondary btn--size-medium" disabled={busy || !name || !startDate || !endDate} onClick={save}>
          {term ? 'Save term' : 'Create term'}
        </button>
        <button className="btn btn--style-primary btn--size-medium" disabled={!term} onClick={onNext}>Next: Classes →</button>
      </div>
    </div>
  )
}

export default StepTerm
```

- [ ] **Step 2: Implement StepClasses**

Replace `src/admin/school/steps/StepClasses.tsx`:

```tsx
'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { api } from '../api'

const StepClasses: React.FC<{ onBack: () => void; onNext: () => void; onChanged: () => void }> = ({ onBack, onNext, onChanged }) => {
  const [termId, setTermId] = useState<string | number | null>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [sessionsByClass, setSessions] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [gradeLevel, setGrade] = useState('')
  const [room, setRoom] = useState('')
  const [capacity, setCap] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async (tid: string | number) => {
    const cl = (await api(`/school-classes?where[term][equals]=${tid}&limit=1000&depth=0`)).docs
    setClasses(cl)
    const counts: Record<string, number> = {}
    for (const c of cl) {
      const s = await api(`/class-sessions?where[class][equals]=${c.id}&limit=0&depth=0`)
      counts[String(c.id)] = s.totalDocs ?? (s.docs?.length ?? 0)
    }
    setSessions(counts)
  }, [])

  useEffect(() => {
    api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0').then(async (r) => {
      const t = r.docs[0]
      if (t) { setTermId(t.id); await reload(t.id) }
    }).catch(() => {})
  }, [reload])

  const add = async () => {
    if (!termId) return
    setBusy(true)
    try {
      const data: any = { name, term: termId, status: 'active' }
      if (gradeLevel) data.gradeLevel = gradeLevel
      if (room) data.room = room
      if (capacity) data.capacity = Number(capacity)
      await api('/school-classes', { method: 'POST', body: JSON.stringify(data) })
      setName(''); setGrade(''); setRoom(''); setCap('')
      await reload(termId)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2>2. Classes</h2>
      <p>Add the classes in this term. Each class automatically gets a weekly session for every meeting day in the term.</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {classes.map((c) => (
          <li key={c.id} style={{ padding: '4px 0' }}>
            <strong>{c.name}</strong>{c.gradeLevel ? ` · ${c.gradeLevel}` : ''} — {sessionsByClass[String(c.id)] ?? 0} sessions
          </li>
        ))}
        {classes.length === 0 && <li style={{ color: 'var(--theme-elevation-500)' }}>No classes yet.</li>}
      </ul>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420, marginTop: 12 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Class name (e.g. Grade 3 Quran)" />
        <input value={gradeLevel} onChange={(e) => setGrade(e.target.value)} placeholder="Grade level (optional)" />
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room (optional)" />
        <input value={capacity} onChange={(e) => setCap(e.target.value)} placeholder="Capacity (optional)" type="number" />
        <button className="btn btn--style-secondary btn--size-medium" disabled={busy || !name} onClick={add}>Add class</button>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button className="btn btn--style-secondary btn--size-medium" onClick={onBack}>← Back</button>
        <button className="btn btn--style-primary btn--size-medium" disabled={classes.length === 0} onClick={onNext}>Next: Teachers →</button>
      </div>
    </div>
  )
}

export default StepClasses
```

- [ ] **Step 3: Typecheck + commit**

Run `npx tsc --noEmit` (clean). Boot dev briefly and confirm the route compiles.
```bash
git add src/admin/school/steps/StepTerm.tsx src/admin/school/steps/StepClasses.tsx
git commit -m "feat(school): wizard Term and Classes steps"
```

---

## Task 7: Step 3 (Teachers) and Step 4 (Students) + Finish

**Files:**
- Modify: `src/admin/school/steps/StepTeachers.tsx`
- Modify: `src/admin/school/steps/StepStudents.tsx`

- [ ] **Step 1: Implement StepTeachers (skippable)**

Replace `src/admin/school/steps/StepTeachers.tsx`:

```tsx
'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { api } from '../api'

const StepTeachers: React.FC<{ onBack: () => void; onNext: () => void }> = ({ onBack, onNext }) => {
  const [classes, setClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [inviteFor, setInviteFor] = useState<string | number | null>(null)
  const [email, setEmail] = useState('')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [msg, setMsg] = useState('')

  const reload = useCallback(async () => {
    const tr = await api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0')
    const term = tr.docs[0]
    if (!term) return
    setClasses((await api(`/school-classes?where[term][equals]=${term.id}&limit=1000&depth=1`)).docs)
    setTeachers((await api('/users?where[role][equals]=teacher&limit=1000&depth=0')).docs)
  }, [])

  useEffect(() => { reload().catch(() => {}) }, [reload])

  const assign = async (classId: string | number, teacherId: string) => {
    await api(`/school-classes/${classId}`, {
      method: 'PATCH',
      body: JSON.stringify({ teachers: teacherId ? [teacherId] : [] }),
    })
    await reload()
  }

  const invite = async (classId: string | number) => {
    setMsg('')
    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName: first, lastName: last, role: 'teacher' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Invite failed')
      // find the freshly-created teacher and assign
      const u = (await api(`/users?where[email][equals]=${encodeURIComponent(email)}&limit=1&depth=0`)).docs[0]
      if (u) await assign(classId, String(u.id))
      setMsg(`Invited ${email}.`); setEmail(''); setFirst(''); setLast(''); setInviteFor(null)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  const teacherName = (c: any) => {
    const t = Array.isArray(c.teachers) ? c.teachers[0] : null
    if (!t) return null
    return typeof t === 'object' ? (t.email ?? `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || 'Assigned') : String(t)
  }

  return (
    <div>
      <h2>3. Teachers <span style={{ fontWeight: 400, fontSize: 14 }}>(optional)</span></h2>
      <p>Assign a teacher to each class, or skip and do it later.</p>
      {classes.map((c) => (
        <div key={c.id} style={{ borderBottom: '1px solid var(--theme-elevation-150)', padding: '8px 0' }}>
          <strong>{c.name}</strong> — {teacherName(c) ?? <em>No teacher assigned</em>}
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value="" onChange={(e) => assign(c.id, e.target.value)}>
              <option value="">— pick existing —</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.email}</option>)}
            </select>
            <button className="btn btn--size-small" onClick={() => setInviteFor(inviteFor === c.id ? null : c.id)}>Invite new</button>
          </div>
          {inviteFor === c.id && (
            <div style={{ display: 'grid', gap: 6, maxWidth: 360, marginTop: 8 }}>
              <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
              <input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
              <button className="btn btn--style-secondary btn--size-small" disabled={!email} onClick={() => invite(c.id)}>Send invite & assign</button>
            </div>
          )}
        </div>
      ))}
      {msg && <p>{msg}</p>}
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button className="btn btn--style-secondary btn--size-medium" onClick={onBack}>← Back</button>
        <button className="btn btn--style-primary btn--size-medium" onClick={onNext}>Skip / Next: Students →</button>
      </div>
    </div>
  )
}

export default StepTeachers
```

- [ ] **Step 2: Implement StepStudents**

Replace `src/admin/school/steps/StepStudents.tsx`:

```tsx
'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { api } from '../api'

const StepStudents: React.FC<{ onBack: () => void; onFinish: () => void; onChanged: () => void }> = ({ onBack, onFinish, onChanged }) => {
  const [classes, setClasses] = useState<any[]>([])
  const [unplaced, setUnplaced] = useState<any[]>([])
  // add-new form
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [age, setAge] = useState('')
  const [guardian, setGuardian] = useState('')
  const [newClass, setNewClass] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const tr = await api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0')
    const term = tr.docs[0]
    if (!term) return
    const cl = (await api(`/school-classes?where[term][equals]=${term.id}&limit=1000&depth=0`)).docs
    setClasses(cl)
    const classIds = cl.map((c: any) => c.id)
    const enr = classIds.length
      ? (await api(`/enrollments?where[class][in]=${classIds.join(',')}&where[status][equals]=active&limit=5000&depth=0`)).docs
      : []
    const placed = new Set(enr.map((e: any) => String(typeof e.student === 'object' ? e.student.id : e.student)))
    const students = (await api('/students?where[status][equals]=active&limit=5000&depth=0')).docs
    setUnplaced(students.filter((s: any) => !placed.has(String(s.id))))
  }, [])

  useEffect(() => { reload().catch(() => {}) }, [reload])

  const place = async (studentId: string | number, classId: string) => {
    if (!classId) return
    await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: studentId, class: classId, status: 'active' }) })
    await reload(); onChanged()
  }

  const addNew = async () => {
    if (!newClass) return
    setBusy(true)
    try {
      const data: any = { firstName: first, lastName: last, status: 'active' }
      if (age) data.age = Number(age)
      if (guardian) data.guardians = [{ name: guardian, isPrimary: true }]
      const student = await api('/students', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: student.id, class: newClass, status: 'active' }) })
      setFirst(''); setLast(''); setAge(''); setGuardian('')
      await reload(); onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2>4. Students</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3>Place registered students</h3>
          {unplaced.length === 0 && <p style={{ color: 'var(--theme-elevation-500)' }}>No unplaced students.</p>}
          {unplaced.map((s) => (
            <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
              <span style={{ flex: 1 }}>{s.fullName ?? `${s.firstName} ${s.lastName}`}{s.age ? ` (age ${s.age})` : ''}</span>
              <select defaultValue="" onChange={(e) => place(s.id, e.target.value)}>
                <option value="">place in…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div>
          <h3>Add a new student</h3>
          <div style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
            <input placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
            <input placeholder="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            <input placeholder="Guardian name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
            <select value={newClass} onChange={(e) => setNewClass(e.target.value)}>
              <option value="">Enroll in class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn btn--style-secondary btn--size-medium" disabled={busy || !first || !last || !newClass} onClick={addNew}>Add & enroll</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <button className="btn btn--style-secondary btn--size-medium" onClick={onBack}>← Back</button>
        <button className="btn btn--style-primary btn--size-medium" onClick={onFinish}>Finish →</button>
      </div>
    </div>
  )
}

export default StepStudents
```

- [ ] **Step 3: Typecheck + commit**

Run `npx tsc --noEmit` (clean) and `npm test` (all pass).
```bash
git add src/admin/school/steps/StepTeachers.tsx src/admin/school/steps/StepStudents.tsx
git commit -m "feat(school): wizard Teachers and Students steps"
```

---

## Task 8: Register components in importMap + full verification

**Files:**
- Modify: `src/app/(payload)/admin/importMap.js` (regenerated)

- [ ] **Step 1: Regenerate the importMap**

Only components referenced by string path in `payload.config.ts` strictly need importMap entries (the nav link). The page/route components are imported directly by Next, but regenerating is safe and keeps the map current.

Run: `npx payload generate:importmap`
Confirm `git diff src/app/(payload)/admin/importMap.js` shows the map is current (the `SundaySchoolNav` entry stays present; nothing removed).

- [ ] **Step 2: Full typecheck + suite**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npm test` → all pass.

- [ ] **Step 3: Manual end-to-end verification**

Boot dev: `npm run dev`. As an `admin`/`school_admin` on a tenant host, click the **Sunday School** nav link → hub renders. Click **Start setup** → create a term (preview shows N sessions) → add a class (session count appears) → skip teachers (or invite one) → add/place a student → Finish returns to the hub with updated tiles. Confirm the six raw collections no longer appear in the nav, and a `teacher` login sees the hub without the setup button.
Expected: full flow works; records created; resume lands on the correct step when re-entering `/admin/sunday-school/setup`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(payload)/admin/importMap.js"
git commit -m "chore(school): regenerate importMap for wizard"
```

---

## Self-Review

**Spec coverage:**
- Hub replaces six nav links, URL-reachable → Task 3 (`hidden: true`) + Task 4 (hub). ✔
- Relationship explainer + status tiles + active-term card with auto-session count → Task 4 (HubClient, `weeklyDates`). ✔
- Wizard Term→Classes→Teachers→Students, deep-linkable, resumable → Tasks 5–7 + `firstIncompleteStep`. ✔
- Term step shows auto-session preview → StepTerm copy + Classes session counts (Task 6). ✔
- Teachers step skippable, pick-or-invite → Task 7 + invite extension (Task 1). ✔
- Students step: place unplaced + add-new, equal weight → Task 7. ✔
- Role gating (hub 4 roles incl. trimmed teacher; wizard 3 roles) → Tasks 4–5. ✔
- Invite endpoint extension w/ tests → Task 1. ✔
- Pure helpers tested → Task 2. ✔
- No migration (no new fields) → stated in Context. ✔

**Placeholder scan:** Step files are intentionally placeholder in Task 5 and explicitly replaced in Tasks 6–7 (each replacement shows full code). No `TODO`/`TBD` left in shipped code.

**Type consistency:** `HubSummary`/`HubTerm` defined in `school-setup.ts` (Task 2) and consumed in Tasks 4–5. `firstIncompleteStep` returns `1|2|4|5`; SetupWizard clamps `5→4` for the Students landing. Step component prop names (`onNext/onBack/onChanged/onFinish`) are fixed in Task 5 placeholders and matched in Tasks 6–7. `api()` signature identical across all step files. `authorizeInvite` signature stable between Task 1 test and impl.
